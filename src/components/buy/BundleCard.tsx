import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function NetworkTag({ code }: { code?: string | null }) {
  const c = String(code ?? "").toUpperCase();
  const base = "flex h-6 items-center justify-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider";
  if (c === "MTN") return <div className={cn(base, "bg-[#ffcc00] text-black")}>MTN</div>;
  if (c === "TELECEL") return <div className={cn(base, "bg-[#cc0000] text-white")}>TELECEL</div>;
  return <div className={cn(base, "bg-[#4a148c] text-white")}>AT</div>;
}

export function BundleCard({
  networkCode,
  networkName,
  sizeLabel,
  price,
  active,
  badge,
  onClick,
}: {
  networkCode?: string | null;
  networkName?: string | null;
  sizeLabel: string;
  price: string;
  active: boolean;
  badge?: "popular" | "best";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-start justify-between rounded-2xl border bg-card p-4 text-left shadow-soft transition-all duration-200",
        active ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50 hover:shadow-float",
      )}
    >
      {badge && !active && (
        <span
          className={cn(
            "absolute -top-2 left-3 z-10 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
            badge === "popular" ? "bg-primary text-primary-foreground" : "bg-emerald-500 text-white",
          )}
        >
          {badge === "popular" ? "Popular" : "Best Value"}
        </span>
      )}

      <div className="mb-3 flex w-full items-center justify-between">
        <NetworkTag code={networkCode} />
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <ArrowRight className="h-3 w-3" />
        </div>
      </div>

      <div className="my-1 w-full">
        <span className="block text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
          {sizeLabel}
        </span>
        <div className="mt-1 flex items-center justify-between gap-1.5">
          <span className="truncate text-[11px] font-semibold text-muted-foreground">{networkName ? `${networkName} data` : ""}</span>
          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
            ⚡ 1-5 min
          </span>
        </div>
      </div>

      <div className="mt-4 w-full border-t border-border pt-3">
        <span className="mb-0.5 block text-[10px] font-bold uppercase leading-none tracking-wider text-muted-foreground">
          Price
        </span>
        <span className="text-xl font-bold tracking-tight tabular-nums text-foreground sm:text-2xl">{price}</span>
      </div>
    </button>
  );
}
