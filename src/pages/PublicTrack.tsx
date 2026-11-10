import { Link } from "react-router-dom";
import { Package, ShieldCheck, Zap } from "lucide-react";
import { TrackOrder } from "@/components/buy/TrackOrder";
import { PublicHeader } from "@/components/PublicHeader";
import { useSettings } from "@/hooks/useSettings";

const FEATURES = [
  { icon: Zap, tone: "text-primary", title: "Instant Fulfillment", desc: "Direct telecom API gateway dispatch" },
  { icon: ShieldCheck, tone: "text-emerald-500", title: "Auto Refund Protection", desc: "Instant wallet credit on order failure" },
  { icon: Package, tone: "text-blue-500", title: "24/7 Live Sync", desc: "Real-time status updates & logs" },
];

export default function PublicTrackPage() {
  const { data: settings } = useSettings();
  const whatsapp = String(settings?.whatsapp_group_link ?? "").trim();
  const supportPhone = String(settings?.support_phone ?? "").replace(/\D/g, "");
  const supportHref = whatsapp || (supportPhone ? `https://wa.me/${supportPhone}` : "");

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <PublicHeader current="track" />

      <div className="mx-auto max-w-3xl space-y-4 px-3 py-4 md:space-y-5 md:px-6 md:py-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Track Telecom Delivery Status</h1>
          <p className="mt-0.5 text-xs text-muted-foreground md:mt-1 md:text-sm">
            Enter your phone number or Order Reference ID below to view real-time delivery status and updates.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft md:p-6">
          <TrackOrder />
        </div>

        <div className="grid gap-4 text-xs sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, tone, title, desc }) => (
            <div key={title} className="space-y-1 rounded-2xl border border-border bg-card p-4 shadow-soft">
              <Icon className={`h-5 w-5 ${tone}`} />
              <h4 className="font-semibold text-foreground">{title}</h4>
              <p className="text-[11px] text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>

        <p className="pt-2 text-center text-xs text-muted-foreground">
          {supportHref && (
            <>
              Need immediate support?{" "}
              <a href={supportHref} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground hover:underline">
                Chat Support Team
              </a>{" "}
              ·{" "}
            </>
          )}
          <Link to="/buy" className="font-semibold text-foreground hover:underline">
            Order New Package
          </Link>
        </p>
      </div>
    </div>
  );
}
