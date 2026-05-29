import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, Check, CheckCircle2, Clock, Copy, Loader2, Package, Search, Truck } from "lucide-react";
import { formatGHS, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

interface OrderResult {
  reference: string;
  recipient_phone: string;
  status: string;
  sell_price: number;
  created_at: string;
  bundle: { size_label: string };
  network: { name: string; logo_emoji: string };
}

const STAGES = [
  { key: "pending",    label: "Ordered",    icon: Clock        },
  { key: "processing", label: "Processing", icon: Truck        },
  { key: "delivered",  label: "Delivered",  icon: CheckCircle2 },
] as const;

export function TrackOrder() {
  const [phone, setPhone]         = useState("");
  const [orders, setOrders]       = useState<OrderResult[] | null>(null);
  const [loading, setLoading]     = useState(false);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  const copyReceipt = (o: OrderResult) => {
    const text =
      `OneGig Data Receipt\n-------------------\nReference: ${o.reference}\nNetwork: ${o.network?.name}\n` +
      `Bundle: ${o.bundle?.size_label}\nRecipient: ${o.recipient_phone}\n` +
      `Date: ${new Date(o.created_at).toLocaleString()}\nPrice: ${formatGHS(o.sell_price)}\nStatus: ${o.status.toUpperCase()}`;
    navigator.clipboard.writeText(text);
    setCopiedRef(o.reference);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  const search = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("reference, recipient_phone, status, sell_price, created_at, bundle:bundles(size_label), network:networks(name, logo_emoji)")
      .or(`recipient_phone.eq.${phone.replace(/\D/g, "")},customer_phone.eq.${phone.replace(/\D/g, "")}`)
      .order("created_at", { ascending: false })
      .limit(10);
    setOrders((data ?? []) as any);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* ── Search input ──────────────────────────────────────────────── */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute left-4 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
            <span className="text-base leading-none">🇬🇭</span>
            <span className="text-sm font-bold text-muted-foreground">+233</span>
            <div className="mx-1 h-4 w-px bg-border/70" />
          </div>
          <input
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && phone.length >= 9 && !loading && search()}
            placeholder="Phone number"
            className="h-14 w-full rounded-2xl border border-border/60 bg-background/70 pl-[92px] pr-4 text-base font-medium outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
          />
        </div>
        <Button
          onClick={search}
          disabled={loading || phone.length < 9}
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

      {/* ── Empty state ───────────────────────────────────────────────── */}
      {orders !== null && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border/40 bg-secondary/20 py-14 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/60">
            <Package className="h-7 w-7 text-muted-foreground/30" />
          </div>
          <p className="text-base font-bold text-muted-foreground">No orders found</p>
          <p className="mt-1 text-sm text-muted-foreground/60">Try a different phone number or check the digits.</p>
        </div>
      )}

      {/* ── Order cards ───────────────────────────────────────────────── */}
      <div className="space-y-4">
        {orders?.map((o) => {
          const failed     = o.status === "failed" || o.status === "refunded";
          const isDelivered = o.status === "delivered";
          const stageIdx   = failed ? -1 : Math.max(0, STAGES.findIndex((s) => s.key === o.status));

          return (
            <div
              key={o.reference}
              className={cn(
                "relative overflow-hidden rounded-3xl border p-5 transition-all",
                isDelivered
                  ? "border-emerald-500/25 bg-emerald-500/[0.04]"
                  : failed
                  ? "border-rose-500/25 bg-rose-500/[0.04]"
                  : "border-border/60 bg-card"
              )}
            >
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
                      {o.reference}
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
                      copiedRef === o.reference
                        ? "bg-emerald-500/15 text-emerald-500"
                        : "bg-secondary/60 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    )}
                  >
                    {copiedRef === o.reference ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {copiedRef === o.reference ? "Copied!" : "Receipt"}
                  </button>
                </div>
              </div>

              {/* Progress / failed state */}
              {failed ? (
                <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                  <p className="text-sm font-semibold text-rose-600">
                    Order failed — refund is being processed.
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
                                "flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300",
                                reached
                                  ? "gradient-primary text-white shadow-soft"
                                  : "bg-muted text-muted-foreground/40"
                              )}
                            >
                              <Icon className="h-4 w-4" />
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
