import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatCardVariant = "primary" | "amber" | "emerald" | "rose";

const VARIANT_STYLES: Record<StatCardVariant, string> = {
  primary: "border-primary/20 bg-primary/5 text-primary",
  amber: "border-amber-500/20 bg-amber-500/5 text-amber-500",
  emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-500",
  rose: "border-rose-500/20 bg-rose-500/5 text-rose-500",
};

export function StatCard({
  title,
  value,
  icon,
  variant,
  helper,
}: {
  title: string;
  value: string;
  icon: ReactNode;
  variant: StatCardVariant;
  helper?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-soft hover:shadow-float transition-all duration-300">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{title}</span>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border", VARIANT_STYLES[variant])}>
          {icon}
        </div>
      </div>
      <div className="mt-4">
        <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
        {helper && <p className="mt-1 text-[11px] font-semibold text-muted-foreground/80">{helper}</p>}
      </div>
    </div>
  );
}
