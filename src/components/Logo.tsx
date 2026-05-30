export function Logo({ size = "md", className }: { size?: "sm" | "md" | "lg", className?: string }) {
  // Map size to height classes
  const hCls = size === "lg" ? "h-16" : size === "sm" ? "h-8" : "h-12";
  
  return (
    <div className={`flex items-center ${className || ""}`}>
      <img 
        src="/logo.jpeg" 
        alt="1Gig Logo" 
        className={`${hCls} w-auto object-contain drop-shadow-sm`}
      />
    </div>
  );
}