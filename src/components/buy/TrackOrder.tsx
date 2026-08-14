import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  MessageCircle,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Truck,
  Zap,
} from "lucide-react";
import { formatGHS, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/ui/OrderStatusBadge";

interface OrderResult {
  id: string;
  reference: string;
  payment_reference: string | null;
  recipient_phone: string;
  status: string;
  sell_price: number;
  created_at: string;
  notes?: string | null;
  bundle: { size_label: string } | null;
  network: { name: string; logo_emoji: string } | null;
}

export function TrackOrder() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("ref") ?? "");
  const [orders, setOrders] = useState<OrderResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [syncingRef, setSyncingRef] = useState<string | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Fetch orders via RPC ──────────────────────────────────────────────────
  const fetchOrders = useCallback(async (q: string) => {
    const raw = q.trim();
    if (!raw) {
      setOrders(null);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc("track_order", { search_query: raw });

      if (error) {
        console.error("Order tracking failed:", error.message);
        setOrders([]);
        setLoading(false);
        return;
      }

      let mapped: OrderResult[] = (data ?? []).map((o: any) => ({
        id: o.id,
        reference: o.reference,
        payment_reference: o.payment_reference,
        recipient_phone: o.recipient_phone,
        status: o.status,
        sell_price: Number(o.sell_price || 0),
        created_at: o.created_at,
        notes: o.notes,
        bundle: o.bundle_size_label ? { size_label: o.bundle_size_label } : null,
        network: o.network_name ? { name: o.network_name, logo_emoji: o.network_logo_emoji } : null,
      }));

      if (mapped.length === 0) {
        const digits = raw.replace(/\D/g, "");
        let qBuilder = supabase
          .from("orders")
          .select("id, reference, payment_reference, recipient_phone, status, sell_price, created_at, notes, bundle:bundles(size_label), network:networks(name, logo_emoji)")
          .order("created_at", { ascending: false })
          .limit(20);

        if (digits.length >= 9) {
          qBuilder = qBuilder.like("recipient_phone", `%${digits.slice(-9)}`);
        } else {
          qBuilder = qBuilder.or(`reference.ilike.%${raw}%,payment_reference.ilike.%${raw}%,id.eq.${raw}`);
        }

        const { data: directOrders } = await qBuilder;
        if (directOrders && directOrders.length > 0) {
          mapped = directOrders.map((o: any) => ({
            id: o.id,
            reference: o.reference,
            payment_reference: o.payment_reference,
            recipient_phone: o.recipient_phone,
            status: o.status,
            sell_price: Number(o.sell_price || 0),
            created_at: o.created_at,
            notes: o.notes,
            bundle: o.bundle ? { size_label: (o.bundle as any).size_label } : null,
            network: o.network ? { name: (o.network as any).name, logo_emoji: (o.network as any).logo_emoji } : null,
          }));
        }
      }

      setOrders(mapped);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Tracking RPC error:", err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync with searchParams & Auto-Fetch
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      setQuery(ref);
      fetchOrders(ref);
    }
  }, [searchParams, fetchOrders]);

  // 4-Second Auto-Polling & 10-Second Live Provider Sync for active processing orders
  useEffect(() => {
    const processingOrders = orders?.filter((o) => ["pending", "processing"].includes(o.status));
    if (!query.trim() || !processingOrders || processingOrders.length === 0) {
      return;
    }

    const interval = setInterval(() => {
      fetchOrders(query);
    }, 4000);

    const syncProviderStatus = async () => {
      for (const order of processingOrders) {
        try {
          await supabase.functions.invoke("admin-provider-action", {
            body: { action: "check_order_status", order_id: order.id },
          });
        } catch (e) {
          console.warn("Live status sync error:", e);
        }
      }
    };

    syncProviderStatus();
    const syncInterval = setInterval(syncProviderStatus, 10000);

    return () => {
      clearInterval(interval);
      clearInterval(syncInterval);
    };
  }, [query, orders, fetchOrders]);

  // Real-time Postgres Channel Listener
  useEffect(() => {
    if (!orders || !orders.length) return;

    const orderIds = orders.map((o) => o.id);
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const ch = supabase
      .channel(`track-orders-live-${Date.now()}`)
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
                    ? { ...o, status: payload.new.status, notes: payload.new.notes }
                    : o
                )
              : prev
          );
          setLastUpdated(new Date());
        }
      )
      .subscribe();

    channelRef.current = ch;

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [orders]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearchParams({ ref: query.trim() });
    fetchOrders(query.trim());
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRef(id);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Search Input Box */}
      <form onSubmit={handleSearchSubmit} className="relative group">
        <div className="relative flex items-center">
          <Search className="absolute left-4 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter Phone (0547xxxxxx) or Order Ref (OG-xxxx)..."
            className="h-14 w-full rounded-xl border border-border bg-background pl-12 pr-32 text-sm font-semibold text-foreground focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
          />
          <Button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2 h-10 rounded-lg px-5 text-xs uppercase tracking-wider"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Track"}
          </Button>
        </div>
      </form>

      {/* Live Status Header indicator if polling */}
      {orders && orders.some((o) => ["pending", "processing"].includes(o.status)) && (
        <div className="flex items-center justify-between rounded-xl border border-blue-500/25 bg-blue-500/5 px-4 py-2.5 text-xs text-blue-500">
          <div className="flex items-center gap-2 font-semibold">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Live Status Syncing Active — Order In Progress</span>
          </div>
          {lastUpdated && (
            <span className="text-[10px] font-mono">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !orders && (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Fetching Live Order Status...
          </p>
        </div>
      )}

      {/* No Orders Found */}
      {!loading && orders !== null && orders.length === 0 && (
        <div className="rounded-[1.75rem] border border-dashed border-border bg-card p-8 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">No Matching Orders Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              We couldn't find an order matching <span className="font-mono text-primary font-semibold">"{query}"</span>. Please check your phone number or reference code.
            </p>
          </div>
          <Link
            to="/buy"
            className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-xs font-semibold text-primary border border-primary/25 hover:bg-primary/15 transition-colors"
          >
            Buy Data Now
          </Link>
        </div>
      )}

      {/* Orders List */}
      {orders && orders.length > 0 && (
        <div className="space-y-6">
          {orders.map((order) => {
            const isProcessing = order.status === "processing" || order.status === "pending";
            const isDelivered = order.status === "delivered";
            const isFailed = order.status === "failed" || order.status === "refunded";

            const step1Complete = true; // Payment confirmed
            const step2Complete = isProcessing || isDelivered; // Dispatched
            const step3Complete = isDelivered; // Delivered

            return (
              <div
                key={order.id}
                className="relative overflow-hidden rounded-[1.75rem] border border-border bg-card p-6 sm:p-7 transition-colors hover:border-primary/30"
              >
                {/* Top Bar: Network & Status Badge */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{order.network?.logo_emoji || "📱"}</span>
                    <div>
                      <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                        {order.bundle?.size_label || "Data Package"}
                        <span className="text-xs text-muted-foreground font-normal">
                          ({order.network?.name || "MTN"})
                        </span>
                      </h3>
                      <p className="text-xs font-mono text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <span>Ref: {order.reference || order.id.slice(0, 8)}</span>
                        <button
                          onClick={() => handleCopy(order.reference || order.id, order.id)}
                          className="hover:text-primary transition-colors"
                          title="Copy Reference"
                        >
                          {copiedRef === order.id ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <OrderStatusBadge status={order.status} size="lg" />
                  </div>
                </div>

                {/* 3-Step Live Progress Visual Bar */}
                <div className="py-6">
                  <div className="relative">
                    {/* Connecting Line */}
                    <div className="absolute left-6 right-6 top-4 -z-0 h-1 bg-border rounded-full">
                      <div
                        className="h-full bg-primary transition-all duration-700 rounded-full"
                        style={{
                          width: step3Complete ? "100%" : step2Complete ? "50%" : "0%",
                        }}
                      />
                    </div>

                    {/* Step Nodes */}
                    <div className="relative z-10 flex justify-between">
                      {/* Step 1: Payment */}
                      <div className="flex flex-col items-center gap-2">
                        <div
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all",
                            step1Complete
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-secondary text-muted-foreground"
                          )}
                        >
                          <Check className="h-4 w-4" />
                        </div>
                        <span className="text-[11px] font-semibold text-muted-foreground">Paid</span>
                      </div>

                      {/* Step 2: Dispatched */}
                      <div className="flex flex-col items-center gap-2">
                        <div
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all",
                            step3Complete
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : isProcessing
                              ? "border-blue-500 bg-blue-500 text-white animate-pulse"
                              : "border-border bg-secondary text-muted-foreground"
                          )}
                        >
                          {isProcessing ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : step3Complete ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Truck className="h-4 w-4" />
                          )}
                        </div>
                        <span className="text-[11px] font-semibold text-muted-foreground">Dispatching</span>
                      </div>

                      {/* Step 3: Delivered */}
                      <div className="flex flex-col items-center gap-2">
                        <div
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all",
                            step3Complete
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : isFailed
                              ? "border-destructive bg-destructive text-white"
                              : "border-border bg-secondary text-muted-foreground"
                          )}
                        >
                          {step3Complete ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : isFailed ? (
                            <AlertTriangle className="h-4 w-4" />
                          ) : (
                            <Smartphone className="h-4 w-4" />
                          )}
                        </div>
                        <span className="text-[11px] font-semibold text-muted-foreground">Delivered</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid gap-3 rounded-2xl bg-background border border-border p-4 sm:grid-cols-3 text-xs">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Recipient Number
                    </span>
                    <p className="font-semibold text-sm text-foreground mt-0.5">
                      {order.recipient_phone}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Amount Paid
                    </span>
                    <p className="font-semibold text-sm text-emerald-500 mt-0.5">
                      {formatGHS(order.sell_price)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Order Time
                    </span>
                    <p className="font-semibold text-sm text-foreground mt-0.5">
                      {timeAgo(order.created_at)}
                    </p>
                  </div>
                </div>

                {/* Automated Refund Callout if Failed */}
                {isFailed && (
                  <div className="mt-4 rounded-xl border border-destructive/25 bg-destructive/5 p-3.5 text-xs text-destructive flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Order Delivery Could Not Complete</p>
                      <p className="text-[11px] opacity-80 mt-0.5">
                        Your payment has been automatically credited back to your account wallet balance. You can retry or use your balance anytime.
                      </p>
                    </div>
                  </div>
                )}

                {/* Bottom Action Footer */}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`https://wa.me/233500000000?text=${encodeURIComponent(
                        `Hello OneGig Support, I need help with my Order Ref: ${order.reference || order.id} for phone ${order.recipient_phone}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3.5 py-2 text-xs font-semibold text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> Live Support Chat
                    </a>

                    {isProcessing && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={syncingRef === order.id}
                        onClick={async () => {
                          setSyncingRef(order.id);
                          try {
                            await supabase.functions.invoke("admin-provider-action", {
                              body: { action: "check_order_status", order_id: order.id },
                            });
                            await fetchOrders(query);
                          } catch (e) {
                            console.warn("Sync status error:", e);
                          } finally {
                            setSyncingRef(null);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border-blue-500/25 bg-blue-500/5 px-3.5 py-2 text-xs text-blue-500 hover:bg-blue-500/10"
                      >
                        {syncingRef === order.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        Sync Live Status
                      </Button>
                    )}
                  </div>

                  <Link
                    to="/buy"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/25 px-3.5 py-2 text-xs font-semibold text-primary hover:bg-primary/15 transition-colors"
                  >
                    Buy Another Bundle
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
