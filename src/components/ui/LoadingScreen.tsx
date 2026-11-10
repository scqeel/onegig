import { Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingScreenProps {
  message?: string;
  submessage?: string;
  variant?: "default" | "fullscreen" | "card" | "dark";
  className?: string;
}

export function LoadingScreen({
  message = "Loading your experience...",
  submessage = "Securing connection & preparing data",
  variant = "fullscreen",
  className,
}: LoadingScreenProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden",
        variant === "fullscreen" && "fixed inset-0 z-50 min-h-dvh w-full bg-background text-foreground",
        variant === "card" && "w-full rounded-2xl border border-border bg-card px-6 py-16 text-foreground",
        variant === "dark" && "dark fixed inset-0 z-50 min-h-dvh w-full bg-background text-foreground",
        className,
      )}
    >
      <div className="flex w-full max-w-sm flex-col items-center rounded-2xl border border-border bg-card px-8 py-10 text-center shadow-soft animate-in fade-in duration-300">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>

        <div className="mt-5 space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Please Wait</p>
          <h3 className="text-lg font-bold text-foreground">{message}</h3>
          <p className="text-xs text-muted-foreground">{submessage}</p>
        </div>

        <div className="mt-6 flex w-full items-center justify-center gap-1.5 border-t border-border pt-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Encrypted · Instant Dispatch</span>
        </div>
      </div>
    </div>
  );
}
