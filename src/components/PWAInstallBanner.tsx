import { useEffect, useState } from "react";
import { Download, X, Smartphone, Wifi } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwa_install_dismissed";
const DISMISSED_UNTIL_KEY = "pwa_install_dismissed_until";

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Don't show if already installed (running in standalone mode)
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // Don't show if permanently dismissed or snoozed
    const dismissedUntil = localStorage.getItem(DISMISSED_UNTIL_KEY);
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) return;
    if (localStorage.getItem(DISMISSED_KEY) === "permanent") return;

    // Detect iOS
    const ios =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !(window.navigator as any).standalone;
    setIsIOS(ios);

    if (ios) {
      // Show iOS instructions after a short delay
      const t = setTimeout(() => setVisible(true), 3000);
      return () => clearTimeout(t);
    }

    // Android / desktop: listen for browser's native prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setVisible(true), 3000);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setInstalling(false);
    if (outcome === "accepted") {
      setVisible(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = (permanent = false) => {
    setVisible(false);
    if (permanent) {
      localStorage.setItem(DISMISSED_KEY, "permanent");
    } else {
      // Snooze for 3 days
      localStorage.setItem(DISMISSED_UNTIL_KEY, String(Date.now() + 3 * 24 * 60 * 60 * 1000));
    }
  };

  if (!visible) return null;

  return (
    <>
      {/* Backdrop blur overlay on mobile */}
      <div
        className="fixed inset-0 z-[998] bg-black/20 backdrop-blur-[2px] sm:hidden"
        onClick={() => handleDismiss(false)}
      />

      {/* Banner */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[999] sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-sm animate-in slide-in-from-bottom-4 duration-500"
        role="dialog"
        aria-label="Install OneGig app"
      >
        <div className="relative overflow-hidden rounded-t-3xl sm:rounded-3xl border border-border/60 bg-card shadow-float">
          {/* Decorative gradient */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-primary/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-fuchsia-500/15 blur-3xl" />

          {/* Dismiss button */}
          <button
            type="button"
            onClick={() => handleDismiss(false)}
            className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-secondary/80 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="relative p-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl gradient-primary shadow-float">
                <Wifi className="h-7 w-7 text-white" />
              </div>
              <div>
                <p className="text-base font-black text-foreground leading-tight">
                  Install OneGig
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Get the full app experience
                </p>
              </div>
            </div>

            {/* Benefits */}
            <div className="mb-5 space-y-2">
              {[
                { icon: "⚡", text: "Faster than the browser" },
                { icon: "📱", text: "Works even with slow internet" },
                { icon: "🔔", text: "Instant order notifications" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-2.5">
                  <span className="text-sm">{icon}</span>
                  <p className="text-xs font-medium text-foreground">{text}</p>
                </div>
              ))}
            </div>

            {!showIOSInstructions ? (
              <>
                {/* Install button */}
                {isIOS ? (
                  <button
                    type="button"
                    onClick={() => setShowIOSInstructions(true)}
                    className="flex w-full items-center justify-center gap-2 h-12 rounded-2xl gradient-primary font-bold text-white text-sm shadow-float transition-all hover:opacity-90 active:scale-[0.98]"
                  >
                    <Smartphone className="h-4 w-4" />
                    How to install on iPhone
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleInstall}
                    disabled={installing}
                    className="flex w-full items-center justify-center gap-2 h-12 rounded-2xl gradient-primary font-bold text-white text-sm shadow-float transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-70"
                  >
                    <Download className="h-4 w-4" />
                    {installing ? "Installing…" : "Add to Home Screen"}
                  </button>
                )}

                {/* Not now */}
                <button
                  type="button"
                  onClick={() => handleDismiss(true)}
                  className="mt-2 w-full py-2.5 text-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Not now
                </button>
              </>
            ) : (
              /* iOS step-by-step instructions */
              <div className="space-y-3">
                <p className="text-xs font-bold text-foreground uppercase tracking-widest">To install:</p>
                {[
                  { step: "1", text: "Tap the Share button at the bottom of Safari" },
                  { step: "2", text: 'Scroll down and tap "Add to Home Screen"' },
                  { step: "3", text: 'Tap "Add" to confirm' },
                ].map(({ step, text }) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full gradient-primary text-[11px] font-black text-white">
                      {step}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">{text}</p>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => handleDismiss(false)}
                  className="mt-2 w-full py-2.5 text-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Got it
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
