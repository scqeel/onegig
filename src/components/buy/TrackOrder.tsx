import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  Package,
  Radio,
  Search,
  Truck,
  X,
} from "lucide-react";
import { formatGHS, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

interface OrderResult {
  id: string;
  reference: string;
  payment_reference: string | null;
  recipient_phone: string;
  status: string;
  sell_price: number;
  created_at: string;
  bundle: { size_label: string } | null;
  network: { name: string; logo_emoji: string } | null;
}

const STAGES = [
  { key: "pending",    label: "Ordered",    icon: Clock        },
  { key: "processing", label: "Processing", icon: Truck        },
  { key: "delivered",  label: "Delivered",  icon: CheckCircle2 },
] as const;

const STATUS_COMPLETE = new Set(["delivered", "failed", "refunded", "rejected"]);

export function TrackOrder() {
  const [searchParams] = useSearchParams();

  const [query, setQuery]           = useState(searchParams.get("ref") ?? "");
  const [orders, setOrders]         = useState<OrderResult[] | null>(null);
  const [loading, setLoading]       = useState(false);
  const [watching, setWatching]     = useState(false);
  const [copiedRef, setCopiedRef]   = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef  = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  // ── Fetch orders ─────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async (q: string) => {
    const raw = q.trim();
    if (!raw) { setOrders(null); return; }

    setLoading(true);
    const digits     = raw.replace(/\D/g, "");
    const isPhone    = digits.length >= 9;
    const isRef      = raw.length >= 4 && (!isPhone || /[a-zA-Z_-]/.test(raw));

    const base = () =>
      supabase
        .from("orders")
        .select(
          "id, reference, payment_reference, recipient_phone, status, sell_price, created_at, bundle:bundles(size_label), network:networks(name, logo_emoji)"
        )
        .order("created_at", { ascending: false })
        .limit(15);

    // Run separate queries to avoid double-encoding % in .or() ilike
    const promises: Promise<{ data: OrderResult[] | null }>[] = [];

    if (isPhone) {
      promises.push(
        base()
          .or(`recipient_phone.eq.${digits},customer_phone.eq.${digits}`)
          .then(({ data }) => ({ data: (data ?? []) as OrderResult[] }))
      );
    }

    if (isRef) {
      promises.push(
        base()
          .ilike("reference", `%${raw}%`)
          .then(({ data }) => ({ data: (data ?? []) as OrderResult[] }))
      );
      promises.push(
        base()
          .ilike("payment_reference", `%${raw}%`)
          .then(({ data }) => ({ data: (data ?? []) as OrderResult[] }))
      );
    }

    const results = await Promise.all(promises);

    // Merge and deduplicate by id
    const seen = new Set<string>();
    const merged: OrderResult[] = [];
    for (const r of results) {
      for (const o of r.data ?? []) {
        if (!seen.has(o.id)) { seen.add(o.id); merged.push(o); }
      }
    }
    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setOrders(merged);
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  // ── Real-time subscription ────────────────────────────────────────────────
  const subscribeToOrders = useCallback(
    (orderIds: string[]) => {
      // Tear down previous subscription
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setWatching(false);
      }
      if (!orderIds.length) return;

      const ch = supabase
        .channel(`track-orders-${orderIds.join("-")}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "orders",
            filter: `id=in.(${orderIds.join(",")})`,
          },
          (payload) => {
            setOrders((prev) =>
              prev
                ? prev.map((o) =>
                    o.id === payload.new.id
                      ? { ...o, status: payload.new.status }
                      : o
                  )
                : prev
            );
            setLastUpdated(new Date());
          }
        )
        .subscribe((status) => {
          setWatching(status === "SUBSCRIBED");
        });

      channelRef.current = ch;
    },
    []
  );

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  // Subscribe when orders change
  useEffect(() => {
    if (!orders || orders.length === 0) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setWatching(false);
      }
      return;
    }
    // Only watch orders that aren't in a terminal state
    const liveIds = orders
      .filter((o) => !STATUS_COMPLETE.has(o.status))
      .map((o) => o.id);

    subscribeToOrders(liveIds);
  }, [orders, subscribeToOrders]);

  // ── Debounced auto-search ─────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const raw = query.trim();
    const digits = raw.replace(/\D/g, "");
    const isRef  = raw.length >= 6 && /[a-zA-Z]/.test(raw);
    const isPhone = digits.length >= 9;

    if (!raw) { setOrders(null); return; }
    if (!isPhone && !isRef) return;

    debounceRef.current = setTimeout(() => fetchOrders(raw), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchOrders]);

  // Auto-fill from URL param
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) { setQuery(ref); fetchOrders(ref); }
  }, []); // eslint-disable-line

  // ── Copy receipt ──────────────────────────────────────────────────────────
  const copyReceipt = (o: OrderResult) => {
    const text =
      `OneGig Data Receipt\n-------------------\nReference: ${o.reference ?? o.tx_ref}\nNetwork: ${o.network?.name}\n` +
      `Bundle: ${o.bundle?.size_label}\nRecipient: ${o.recipient_phone}\n` +
      `Date: ${new Date(o.created_at).toLocaleString()}\nPrice: ${formatGHS(o.sell_price)}\nStatus: ${o.status.toUpperCase()}`;
    navigator.clipboard.writeText(text);
    setCopiedRef(o.reference ?? o.tx_ref ?? o.id);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  const clearSearch = () => {
    setQuery("");
    setOrders(null);
    inputRef.current?.focus();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Search bar ────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex gap-3">
          <div className="relative flex-1">
            {/* Left icon / prefix */}
            <div className="pointer-events-none absolute left-4 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
              <Search className="h-4 w-4 text-muted-foreground/60" />
              <div className="mx-1 h-4 w-px bg-border/70" />
            </div>

            <input
              ref={inputRef}
              inputMode="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchOrders(query)}
              placeholder="Phone number or order reference…"
              className="h-14 w-full rounded-2xl border border-border/60 bg-background/70 pl-[68px] pr-12 text-base font-medium outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
            />

            {/* Clear button */}
            {query && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Button
            onClick={() => fetchOrders(query)}
            disabled={loading || query.trim().length < 4}
            className="h-14 rounded-2xl px-5 gradient-primary font-bold shadow-soft transition-all hover:scale-[1.02] active:scale-[0.98] disabled:scale-100 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Search className="h-5 w-5" />
            )}
            <span className="ml-2 hidden sm:inline">{loading ? "Searching…" : "Track"}</span>
          </Button>
        </div>

        {/* Real-time status bar */}
        {watching && orders && orders.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
            <Radio className="h-3.5 w-3.5 text-primary animate-pulse" />
            <p className="text-[11px] font-semibold text-primary">
              Watching for updates in real-time
            </p>
            {lastUpdated && (
              <span className="ml-auto text-[10px] text-muted-foreground">
                Last updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        )}

        {/* Hint */}
        {!orders && !loading && (
          <p className="pl-1 text-[11px] text-muted-foreground/60">
            Enter the phone number used at checkout, or paste an order reference.
          </p>
        )}
      </div>

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {orders !== null && orders.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border/40 bg-secondary/20 py-14 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/60">
            <Package className="h-7 w-7 text-muted-foreground/30" />
          </div>
          <p className="text-base font-bold text-muted-foreground">No orders found</p>
          <p className="mt-1 text-sm text-muted-foreground/60">
            Try a different phone number or paste the full reference.
          </p>
        </div>
      )}

      {/* ── Order cards ────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {orders?.map((o) => {
          const failed      = o.status === "failed" || o.status === "refunded" || o.status === "rejected";
          const isDelivered = o.status === "delivered";
          const isLive      = !STATUS_COMPLETE.has(o.status);
          const stageIdx    = failed ? -1 : Math.max(0, STAGES.findIndex((s) => s.key === o.status));
          const ref         = o.reference ?? o.tx_ref ?? o.id;

          return (
            <div
              key={o.id}
              className={cn(
                "relative overflow-hidden rounded-3xl border p-5 transition-all duration-500",
                isDelivered
                  ? "border-emerald-500/25 bg-emerald-500/[0.04]"
                  : failed
                  ? "border-rose-500/25 bg-rose-500/[0.04]"
                  : "border-border/60 bg-card"
              )}
            >
              {/* Live badge */}
              {isLive && watching && (
                <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  Live
                </span>
              )}

              {/* Top row */}
              <div className="flex items-start justify-between gap-4">
                {/* Left: emoji + details */}
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl leading-none",
                      isDelivered
                        ? "bg-emerald-500/10"
                        : failed
                        ? "bg-rose-500/10"
                        : "bg-secondary/60"
                    )}
                  >
                    {o.network?.logo_emoji ?? "📦"}
                  </div>
                  <div>
                    <p className="text-base font-black leading-tight text-foreground">
                      {o.network?.name} · {o.bundle?.size_label}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">→ {o.recipient_phone}</p>
                    <code className="mt-1.5 inline-block rounded-lg bg-secondary/60 px-2 py-0.5 font-mono text-[10px] tracking-wide text-muted-foreground">
                      {ref}
                    </code>
                  </div>
                </div>

                {/* Right: price + copy */}
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="text-right">
                    <p className="text-xl font-black tabular-nums leading-none text-foreground">
                      {formatGHS(o.sell_price)}
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-muted-foreground">{timeAgo(o.created_at)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyReceipt(o)}
                    className={cn(
                      "flex h-7 items-center gap-1 rounded-lg px-2.5 text-[10px] font-bold uppercase tracking-wider transition-all",
                      copiedRef === ref
                        ? "bg-emerald-500/15 text-emerald-500"
                        : "bg-secondary/60 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    )}
                  >
                    {copiedRef === ref ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {copiedRef === ref ? "Copied!" : "Receipt"}
                  </button>
                </div>
              </div>

              {/* Progress / failed state */}
              {failed ? (
                <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                  <p className="text-sm font-semibold text-rose-600">
                    Order {o.status} — refund is being processed.
                  </p>
                </div>
              ) : (
                <div className="mt-6">
                  <div className="flex items-center">
                    {STAGES.map((s, i) => {
                      const reached = i <= stageIdx;
                      const active  = i === stageIdx;
                      const Icon    = s.icon;
                      return (
                        <div key={s.key} className="flex flex-1 items-center">
                          <div className="flex flex-col items-center gap-2">
                            <div
                              className={cn(
                                "flex h-9 w-9 items-center justify-center rounded-full transition-all duration-500",
                                reached
                                  ? "gradient-primary text-white shadow-soft"
                                  : "bg-muted text-muted-foreground/40",
                                active && !isDelivered && "ring-2 ring-primary/30 ring-offset-2"
                              )}
                            >
                              <Icon className={cn("h-4 w-4", active && !isDelivered && "animate-pulse")} />
                            </div>
                            <span
                              className={cn(
                                "whitespace-nowrap text-[11px] font-bold transition-colors",
                                reached
                                  ? active
                                    ? "text-primary"
                                    : "text-foreground"
                                  : "text-muted-foreground/40"
                              )}
                            >
                              {s.label}
                            </span>
                          </div>
                          {i < STAGES.length - 1 && (
                            <div className="mx-2 mb-5 h-1 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn(
                                  "h-full rounded-full gradient-primary transition-all duration-700",
                                  i < stageIdx ? "w-full" : "w-0"
                                )}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Delivered ambient glow */}
              {isDelivered && (
                <div className="pointer-events-none absolute -right-4 -top-4 h-28 w-28 rounded-full bg-emerald-500/15 blur-2xl" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
