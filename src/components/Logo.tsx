import { cn } from "@/lib/utils";

export function Logo({ size = "md", className }: { size?: "sm" | "md" | "lg", className?: string }) {
  // Map size to styling configurations
  const sizeClasses = {
    sm: {
      text: "text-lg sm:text-xl",
      badge: "h-6 w-6 sm:h-7 sm:w-7 rounded-[7px]",
      icon: "w-3.5 h-3.5",
      gap: "gap-1.5",
    },
    md: {
      text: "text-2xl sm:text-3xl",
      badge: "h-8 w-8 sm:h-9 sm:w-9 rounded-[9px]",
      icon: "w-4.5 h-4.5 sm:w-5 sm:h-5",
      gap: "gap-2",
    },
    lg: {
      text: "text-4xl sm:text-5xl",
      badge: "h-11 w-11 sm:h-12 sm:w-12 rounded-xl",
      icon: "w-6 h-6 sm:w-7 sm:h-7",
      gap: "gap-3",
    },
  };

  const config = sizeClasses[size];

  return (
    <div className={cn("flex items-center select-none font-display font-bold tracking-tight", config.gap, className)}>
      <span className={cn("dark flex shrink-0 items-center justify-center bg-background", config.badge)}>
        <svg
          className={cn("text-primary shrink-0", config.icon)}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="15.5" r="1.4" className="fill-current animate-signal-1" stroke="none" />
          <path d="M8.7 12.3a4.7 4.7 0 0 1 6.6 0" className="animate-signal-2" strokeWidth="3" />
          <path d="M5.5 9a9 9 0 0 1 13 0" className="animate-signal-3" strokeWidth="2.6" />
        </svg>
      </span>
      <span className={cn("text-foreground transition-colors duration-300", config.text)}>
        One
      </span>
      <span className={cn("text-primary transition-colors duration-300 -ml-1", config.text)}>
        gig
      </span>
    </div>
  );
}