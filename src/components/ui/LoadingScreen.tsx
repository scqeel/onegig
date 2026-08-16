import React from "react";
import { cn } from "@/lib/utils";
import { Sparkles, Zap, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";

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
  const isDarkVariant = variant === "dark";

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden transition-all duration-500",
        variant === "fullscreen" && "fixed inset-0 z-50 min-h-dvh w-full bg-background/95 backdrop-blur-md text-foreground",
        variant === "card" && "w-full py-16 px-6 rounded-3xl bg-card/60 border border-border/50 text-foreground backdrop-blur-sm shadow-sm",
        variant === "dark" && "fixed inset-0 z-50 min-h-dvh w-full bg-slate-950 text-white",
        className
      )}
    >
      {/* Background ambient glowing orbs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-primary/10 blur-[90px] pointer-events-none animate-pulse" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-emerald-500/10 blur-[70px] pointer-events-none animate-pulse delay-700" />

      {/* Main Glass Card */}
      <div className="relative z-10 flex flex-col items-center max-w-sm px-8 py-10 rounded-[2.5rem] bg-card/80 dark:bg-slate-900/80 border border-border/60 shadow-2xl backdrop-blur-xl text-center animate-in fade-in zoom-in-95 duration-500">
        
        {/* Animated Outer Spinner & Central Logo Ring */}
        <div className="relative mb-6 flex items-center justify-center">
          {/* Outer glowing rotation ring */}
          <div className="h-20 w-20 rounded-full border-2 border-primary/20 border-t-primary border-r-primary/60 animate-spin transition-all duration-1000" />
          
          {/* Inner counter-rotating ring */}
          <div className="absolute h-14 w-14 rounded-full border-2 border-emerald-500/20 border-b-emerald-500 animate-[spin_2s_linear_infinite_reverse]" />

          {/* Central Logo Box */}
          <div className="absolute h-12 w-12 rounded-2xl bg-gradient-to-tr from-primary/20 via-primary/10 to-emerald-500/20 border border-primary/30 flex items-center justify-center shadow-inner group">
            <Zap className="h-6 w-6 text-primary animate-pulse" />
          </div>
        </div>

        {/* Brand & Loading Text */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary">
            <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-spin" style={{ animationDuration: '4s' }} />
            <span>Please Wait</span>
          </div>

          <h3 className="text-lg font-extrabold tracking-tight text-foreground dark:text-white">
            {message}
          </h3>

          <p className="text-xs font-medium text-muted-foreground dark:text-slate-400 max-w-[220px]">
            {submessage}
          </p>
        </div>

        {/* Shimmering Animated Loading Bar */}
        <div className="mt-6 w-44 h-1.5 rounded-full bg-secondary overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary to-transparent animate-[shimmer_1.5s_infinite] w-full" 
               style={{
                 backgroundSize: '200% 100%',
                 animation: 'shimmer 1.5s ease-in-out infinite'
               }} 
          />
        </div>

        {/* Trust indicator footer */}
        <div className="mt-6 pt-4 border-t border-border/40 w-full flex items-center justify-center gap-1.5 text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-wider">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Encrypted · Instant Dispatch</span>
        </div>
      </div>
    </div>
  );
}
