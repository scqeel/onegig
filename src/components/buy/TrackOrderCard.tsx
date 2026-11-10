import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, CheckCircle2, Copy, Loader2, MessageCircle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NetworkTag } from "@/components/buy/BundleCard";
import { formatGHS, timeAgo } from "@/lib/format";
import { getOrderProgress, networkTagCode, OrderStepState } from "@/lib/orderProgress";
import { cn } from "@/lib/utils";

export interface TrackedOrder {
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

function StepDot({ state }: { state: OrderStepState }) {
  const style: Record<OrderStepState, string> = {
    done: "bg-primary text-primary-foreground",
    current: "border-2 border-primary bg-card text-foreground",
    upcoming: "border border-border bg-card text-muted-foreground",
    failed: "bg-rose-500 text-white",
  };
  return (
    <span className={cn("relative z-10 flex h-8 w-8 items-center justify-center rounded-full", style[state])}>
      {state === "done" && <Check className="h-4 w-4" />}
      {state === "current" && <Loader2 className="h-4 w-4 animate-spin" />}
      {state === "failed" && <X className="h-4 w-4" />}
      {state === "upcoming" && <span className="h-1.5 w-1.5 rounded-full bg-border" />}
    </span>
  );
}

export function TrackOrderCard({
  order,
  supportHref,
  syncing,
  onSync,
}: {
  order: TrackedOrder;
  supportHref?: string;
  syncing: boolean;
  onSync: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const progress = getOrderProgress(order.status);
  const reference = order.reference || order.id;
  const code = networkTagCode(order.network?.name);

  const support = supportHref?.includes("wa.me")
    ? `${supportHref}?text=${encodeURIComponent(`Hello OneGig Support, I need help with my Order Ref: ${reference} for phone ${order.recipient_phone}`)}`
    : supportHref;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <header className="flex items-start justify-between gap-3 p-5 pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {code ? <NetworkTag code={code} /> : <span className="text-[11px] font-semibold text-muted-foreground">{order.network?.name}</span>}
            <span className="text-xs text-muted-foreground">{timeAgo(order.created_at)}</span>
          </div>
          <h3 className="mt-2 truncate text-2xl font-bold text-foreground">{order.bundle?.size_label || "Data Package"}</h3>
          <p
            className={cn(
              "mt-0.5 flex items-center gap-1.5 text-sm font-semibold",
              progress.tone === "success" && "text-emerald-600 dark:text-emerald-400",
              progress.tone === "failed" && "text-rose-600 dark:text-rose-400",
              progress.tone === "active" && "text-foreground",
            )}
          >
            {progress.tone === "success" && <CheckCircle2 className="h-4 w-4" />}
            {progress.headline}
          </p>
        </div>
      </header>

      <ol className="flex items-start border-t border-border px-5 py-4">
        {progress.steps.map((step, i) => {
          const reached = step.state !== "upcoming";
          return (
            <li key={step.label} className="relative flex flex-1 flex-col items-center gap-1.5 text-center">
              {i > 0 && (
                <span className={cn("absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2", step.state === "failed" ? "bg-rose-500" : reached ? "bg-primary" : "bg-border")} />
              )}
              <StepDot state={step.state} />
              <span className={cn("text-[11px] leading-tight", reached ? "font-semibold text-foreground" : "text-muted-foreground")}>{step.label}</span>
            </li>
          );
        })}
      </ol>

      <dl className="space-y-2.5 border-t border-dashed border-border px-5 py-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Recipient</dt>
          <dd className="font-semibold tabular-nums text-foreground">{order.recipient_phone}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Amount paid</dt>
          <dd className="font-semibold tabular-nums text-foreground">{formatGHS(order.sell_price)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">Reference</dt>
          <dd className="min-w-0">
            <button
              type="button"
              aria-label="Copy reference"
              onClick={() => {
                navigator.clipboard.writeText(reference);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="inline-flex max-w-full items-center gap-1.5 font-mono text-xs font-semibold text-foreground"
            >
              <span className="truncate">{reference}</span>
              {copied ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            </button>
          </dd>
        </div>
      </dl>

      {progress.tone === "failed" && (
        <div className="mx-5 mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-semibold">Order delivery could not complete.</span> Your payment has been automatically credited back to your account wallet balance. You can retry or use your balance anytime.
          </p>
        </div>
      )}

      <footer className="flex flex-wrap gap-2 border-t border-border bg-secondary/30 p-3">
        {progress.isActive && (
          <Button size="sm" variant="outline" disabled={syncing} onClick={onSync} className="h-9 gap-1.5 rounded-xl text-xs font-semibold">
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh status
          </Button>
        )}
        {support && (
          <Button asChild size="sm" variant="outline" className="h-9 gap-1.5 rounded-xl text-xs font-semibold">
            <a href={support} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-3.5 w-3.5" /> Get help
            </a>
          </Button>
        )}
        <Button asChild size="sm" className="ml-auto h-9 rounded-xl text-xs font-semibold">
          <Link to="/buy">Buy Another</Link>
        </Button>
      </footer>
    </article>
  );
}
