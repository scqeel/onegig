import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface OrderSummaryRow {
  label: string;
  value: ReactNode;
  /** Marks the totals row: bold, primary-colored, separated by a rule. */
  emphasis?: boolean;
}

interface OrderSummaryProps {
  heading?: { eyebrow?: string; title: string };
  rows: OrderSummaryRow[];
  className?: string;
}

export function OrderSummary({ heading, rows, className }: OrderSummaryProps) {
  return (
    <div className={cn("rounded-2xl border border-border bg-background p-5 space-y-3", className)}>
      {heading && (
        <div className="flex flex-col gap-0.5 pb-1">
          {heading.eyebrow && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{heading.eyebrow}</span>
          )}
          <span className="text-lg font-bold text-foreground leading-tight">{heading.title}</span>
        </div>
      )}
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div
            key={i}
            className={cn(
              "flex justify-between items-center text-xs",
              r.emphasis && "text-sm font-bold border-t border-border pt-2.5 mt-1"
            )}
          >
            <span className={r.emphasis ? "text-foreground" : "text-muted-foreground"}>{r.label}</span>
            <span className={r.emphasis ? "text-primary text-base" : "font-semibold text-foreground"}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
