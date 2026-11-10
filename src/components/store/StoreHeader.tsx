import { Bell, Share, Store } from "lucide-react";
import { cn } from "@/lib/utils";

const PROMO_STYLES: Record<string, string> = {
  "midnight-gold": "bg-gradient-to-r from-stone-900 via-stone-950 to-stone-900 text-yellow-400 border-yellow-500/25",
  "fire-ruby": "bg-gradient-to-r from-rose-950 via-red-950 to-rose-950 text-rose-200 border-red-500/25",
  "success-emerald": "bg-gradient-to-r from-emerald-950 via-teal-950 to-emerald-950 text-emerald-300 border-emerald-500/25",
};
const PROMO_DEFAULT = "bg-gradient-to-r from-rose-950 via-indigo-950 to-rose-950 text-amber-300 border-indigo-500/25";

/** Agents pick one of these banner styles in their settings, so it keeps its own colours. */
export function StorePromoBanner({ text, bannerStyle }: { text: string; bannerStyle?: string | null }) {
  return (
    <div
      className={cn(
        "flex w-full items-center overflow-hidden border-b py-2.5 text-xs font-bold uppercase tracking-wider",
        PROMO_STYLES[bannerStyle ?? ""] ?? PROMO_DEFAULT,
      )}
    >
      <div className="og-promo-marquee whitespace-nowrap">
        {text} &nbsp; &nbsp; • &nbsp; &nbsp; {text} &nbsp; &nbsp; • &nbsp; &nbsp; {text}
      </div>
    </div>
  );
}

export function StoreLogo({ url, name, className }: { url?: string | null; name: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-primary/20 bg-primary/10 text-primary",
        className,
      )}
    >
      {url ? <img src={url} alt={`${name} logo`} className="h-full w-full object-cover" /> : <Store className="h-6 w-6" />}
    </div>
  );
}

const ICON_BUTTON =
  "flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95";

export function StoreHeader({
  name,
  tagline,
  logoUrl,
  onNotifications,
  onShare,
}: {
  name: string;
  tagline?: string | null;
  logoUrl?: string | null;
  onNotifications: () => void;
  onShare: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <StoreLogo url={logoUrl} name={name} className="h-12 w-12 md:h-14 md:w-14" />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-bold text-foreground md:text-3xl">{name}</h1>
        <p className="truncate text-xs text-muted-foreground md:text-sm">{tagline || "Fast data. Better prices."}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" aria-label="Share store" onClick={onShare} className={ICON_BUTTON}>
          <Share className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Notifications" onClick={onNotifications} className={ICON_BUTTON}>
          <Bell className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
