import { cn } from "@/lib/utils";

export function Logo({ size = "md", className }: { size?: "sm" | "md" | "lg", className?: string }) {
  // Map size to styling configurations
  const sizeClasses = {
    sm: {
      text: "text-lg sm:text-xl",
      icon: "w-4 h-4 ml-1",
      gap: "gap-1",
    },
    md: {
      text: "text-2xl sm:text-3xl",
      icon: "w-5.5 h-5.5 sm:w-6 sm:h-6 ml-1.5",
      gap: "gap-1.5",
    },
    lg: {
      text: "text-4xl sm:text-5xl",
      icon: "w-8 h-8 ml-2.5",
      gap: "gap-2.5",
    },
  };

  const config = sizeClasses[size];

  return (
    <div className={cn("flex items-center select-none font-display font-bold tracking-tight", config.gap, className)}>
      <span className={cn("text-foreground transition-colors duration-300", config.text)}>
        One
      </span>
      <span className={cn("text-primary transition-colors duration-300", config.text)}>
        gig
      </span>
      <svg
        className={cn("text-primary transition-colors duration-300 shrink-0", config.icon)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="18" r="1.5" className="fill-current animate-signal-1" stroke="none" />
        <path d="M8.5 14.5a5 5 0 0 1 7 0" className="animate-signal-2" strokeWidth="3.2" />
        <path d="M5 11a10 10 0 0 1 14 0" className="animate-signal-3" strokeWidth="2.8" />
      </svg>
    </div>
  );
}