import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The console status bar: a live indicator with a title on the left and
 * actions on the right. Used by admin and customer-facing pages alike.
 */
export function StatusRibbon({
  icon,
  live = true,
  title,
  badge,
  subtitle,
  actions,
  className,
}: {
  icon: ReactNode;
  live?: boolean;
  title: ReactNode;
  badge?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-r from-card via-card/90 to-primary/5 p-4 shadow-soft backdrop-blur-xl",
        className,
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            {icon}
            {live && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">{title}</span>
              {badge}
            </div>
            {subtitle && (
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">{subtitle}</div>
            )}
          </div>
        </div>

        {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
      </div>
    </div>
  );
}

/** Small status label that sits beside a ribbon title. */
export function RibbonBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
      {children}
    </span>
  );
}
