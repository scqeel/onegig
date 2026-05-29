import { useState, useEffect } from "react";
import { X, Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InstallPromptModal() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Wait a bit before showing to not be too aggressive
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (!showPrompt || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-5 md:left-auto md:w-96 md:bottom-8 md:right-8">
      <div className="rounded-2xl border border-primary/20 bg-card/95 p-5 shadow-2xl backdrop-blur-xl">
        <button 
          onClick={() => setShowPrompt(false)}
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
        
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-600 text-white shadow-inner">
            <Smartphone className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Install OneGig App</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add to your home screen for faster access, offline features, and a better mobile experience!
            </p>
            <div className="mt-4 flex gap-2">
              <Button onClick={handleInstall} className="flex-1 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-md shadow-primary/20">
                <Download className="mr-2 h-4 w-4" /> Install Now
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
