import { ReactNode, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";

export function AppShell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const { data: settings } = useSettings();
  const [dismissed, setDismissed] = useState(false);

  const inDashboard = loc.pathname.startsWith("/dashboard") || loc.pathname.startsWith("/admin");
  const popupNotice = String(settings?.popup_notice ?? "").trim();
  const supportHref = useMemo(() => {
    const whatsapp = String(settings?.whatsapp_group_link ?? "").trim();
    if (whatsapp) return whatsapp;
    const phone = String(settings?.support_phone ?? "").replace(/\D/g, "");
    return phone ? `https://wa.me/${phone}` : "";
  }, [settings?.support_phone, settings?.whatsapp_group_link]);

  useEffect(() => {
    if (popupNotice) {
      const key = `notice:${popupNotice}`;
      setDismissed(window.localStorage.getItem(key) === "1");
    }
  }, [popupNotice]);

  const dismissNotice = () => {
    if (!popupNotice) return;
    const key = `notice:${popupNotice}`;
    window.localStorage.setItem(key, "1");
    setDismissed(true);
  };

  return (
    <div className="min-h-dvh w-full pb-24">
      {inDashboard && popupNotice && !dismissed && (
        <div className="sticky top-0 z-30 border-b border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground backdrop-blur-sm">
          <div className="mx-auto flex w-full max-w-[1360px] items-center justify-between gap-3">
            <p>{popupNotice}</p>
            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={dismissNotice}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {children}

      {inDashboard && supportHref && (
        <a
          href={supportHref}
          target="_blank"
          rel="noreferrer"
          className="fixed bottom-5 left-5 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-float hover:bg-primary/90"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </a>
      )}
    </div>
  );
}