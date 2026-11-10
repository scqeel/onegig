import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PillTab<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export const PILL_TAB_BASE =
  "flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all whitespace-nowrap";
export const PILL_TAB_ACTIVE = "bg-primary text-primary-foreground shadow-sm";
export const PILL_TAB_IDLE = "text-muted-foreground hover:text-foreground hover:bg-background/60";

/** The console's pill-tab bar. `stretch` makes the tabs share the full width, for phones. */
export function PillTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  stretch = false,
  className,
  tabClassName,
}: {
  tabs: PillTab<T>[];
  value: T;
  onChange: (value: NoInfer<T>) => void;
  label?: string;
  stretch?: boolean;
  className?: string;
  tabClassName?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1 rounded-xl border border-border/40 bg-secondary/30 p-1", className)}>
      {label && (
        <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      )}
      <div className={cn("flex items-center gap-1", stretch && "w-full")}>
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            aria-pressed={value === tab.value}
            onClick={() => onChange(tab.value)}
            className={cn(
              PILL_TAB_BASE,
              value === tab.value ? PILL_TAB_ACTIVE : PILL_TAB_IDLE,
              stretch && "min-w-0 flex-1",
              tabClassName,
            )}
          >
            {tab.icon}
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
