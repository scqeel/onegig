import { ReactNode, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle, Megaphone, X, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSettings } from "@/hooks/useSettings";
import { InstallPromptModal } from "@/components/ui/InstallPromptModal";
import { InAppNotificationListener } from "@/components/ui/InAppNotificationListener";
import { DraggableWhatsApp } from "@/components/agent/DraggableWhatsApp";
import { DraggableThemeToggle } from "@/components/ui/DraggableThemeToggle";

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

  const homePageBg = settings?.home_page_bg && settings.home_page_bg !== "none" ? settings.home_page_bg : null;

  return (
    <div className="relative min-h-dvh w-full pb-24">
      {homePageBg && (
        <>
          <div 
            className="fixed inset-0 pointer-events-none -z-50 bg-cover bg-center bg-no-repeat transition-all duration-700 animate-bg-zoom"
            style={{ backgroundImage: `url(${homePageBg})` }}
          />
          <div className="fixed inset-0 pointer-events-none -z-40 bg-background/85 backdrop-blur-[12px] transition-all duration-700" />
        </>
      )}
      {inDashboard && popupNotice && !dismissed && (
        <div className="sticky top-0 z-40 w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 px-4 py-2.5 shadow-md">
          <div className="mx-auto flex w-full max-w-[1360px] items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 shadow-inner">
                <Megaphone className="h-3.5 w-3.5 text-white" />
              </span>
              <p className="text-sm font-semibold tracking-wide text-white">
                {popupNotice}
              </p>
            </div>
            <button 
              className="flex items-center justify-center rounded-full p-1.5 bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors" 
              onClick={dismissNotice}
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {children}

      {inDashboard && supportHref && (
        <DraggableWhatsApp link={supportHref} />
      )}

      {/* Global Floating Theme Switcher */}
      <DraggableThemeToggle />

      <InstallPromptModal />
      <InAppNotificationListener />
    </div>
  );
}