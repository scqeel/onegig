import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Clock, Truck, X, Copy, Check } from "lucide-react";
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
  { key: "pending", label: "Ordered", icon: Clock },
  { key: "processing", label: "Processing", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
] as const;

export function TrackOrder() {
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<OrderResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  const copyReceipt = (o: OrderResult) => {
    const text = `OneGig Data Receipt
-------------------
Reference: ${o.reference}
Network: ${o.network?.name}
Bundle: ${o.bundle?.size_label}
Recipient: ${o.recipient_phone}
Date: ${new Date(o.created_at).toLocaleString()}
Price: ${formatGHS(o.sell_price)}
Status: ${o.status.toUpperCase()}`;
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
    <div className="space-y-5">
      <div className="flex gap-2">
        <Input
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
          className="h-14 rounded-2xl px-5 bg-card text-lg"
        />
        <Button onClick={search} disabled={loading || phone.length < 9} className="h-14 rounded-2xl px-5 gradient-primary">
          Track
        </Button>
      </div>

      {orders && orders.length === 0 && (
        <div className="text-center text-muted-foreground py-8">No orders found for that number.</div>
      )}

      <div className="space-y-3">
        {orders?.map((o) => {
          const failed = o.status === "failed" || o.status === "refunded";
          const stageIdx = failed ? -1 : Math.max(0, STAGES.findIndex((s) => s.key === o.status));
          return (
            <div key={o.reference} className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-sm font-bold text-foreground">{o.network?.name} · {o.bundle?.size_label}</div>
                  <div className="font-mono text-xs text-muted-foreground mt-1">{o.reference}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-right">
                    <div className="font-black text-lg leading-none">{formatGHS(o.sell_price)}</div>
                    <div className="text-[10px] font-medium text-muted-foreground mt-1 uppercase tracking-wider">{timeAgo(o.created_at)}</div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => copyReceipt(o)}
                    className="h-7 text-[10px] uppercase tracking-wider rounded-lg border-border/60 bg-background/50 hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    {copiedRef === o.reference ? <Check className="mr-1 h-3 w-3 text-emerald-500" /> : <Copy className="mr-1 h-3 w-3" />}
                    {copiedRef === o.reference ? "Copied" : "Copy Receipt"}
                  </Button>
                </div>
              </div>
              {failed ? (
                <div className="mt-4 flex items-center gap-2 text-destructive">
                  <X className="h-4 w-4" /> Failed — refund processing
                </div>
              ) : (
                <div className="mt-5 flex items-center justify-between">
                  {STAGES.map((s, i) => {
                    const reached = i <= stageIdx;
                    const Icon = s.icon;
                    return (
                      <div key={s.key} className="flex-1 flex flex-col items-center relative">
                        {i > 0 && (
                          <div
                            className={cn(
                              "absolute top-3 right-1/2 h-0.5 w-full -z-0",
                              i <= stageIdx ? "bg-primary" : "bg-border"
                            )}
                          />
                        )}
                        <div
                          className={cn(
                            "z-10 h-7 w-7 rounded-full flex items-center justify-center transition-all",
                            reached ? "gradient-primary text-white shadow-soft" : "bg-muted text-muted-foreground"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className={cn("mt-2 text-xs", reached ? "text-foreground" : "text-muted-foreground")}>{s.label}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}