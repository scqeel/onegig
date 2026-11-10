import { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { StoreLogo } from "@/components/store/StoreHeader";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-semibold text-foreground">{children}</span>
    </div>
  );
}

export function StoreInfoPanel({
  name,
  logoUrl,
  storeAddress,
  hasSupport,
  showWidgetToggle,
  widgetEnabled,
  onToggleWidget,
}: {
  name: string;
  logoUrl?: string | null;
  storeAddress: string;
  hasSupport: boolean;
  showWidgetToggle: boolean;
  widgetEnabled: boolean;
  onToggleWidget: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <StoreLogo url={logoUrl} name={name} className="h-11 w-11" />
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-foreground">{name}</h2>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reseller Partner Store</p>
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-2 text-xs">
        <Row label="Store Link">
          <span className="font-mono">{storeAddress}</span>
        </Row>
        <Row label="Status">
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Fully Activated
          </span>
        </Row>
        <Row label="Support">{hasSupport ? "WhatsApp" : "Not listed"}</Row>
      </div>

      {showWidgetToggle && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
          <div>
            <span className="block text-xs font-bold text-foreground">Draggable WhatsApp Widget</span>
            <span className="text-[10px] text-muted-foreground">Show floating support button to customers</span>
          </div>
          <Switch checked={widgetEnabled} onCheckedChange={onToggleWidget} aria-label="Draggable WhatsApp Widget" />
        </div>
      )}
    </div>
  );
}
