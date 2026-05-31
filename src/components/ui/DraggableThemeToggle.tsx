import { useState, useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export function DraggableThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [position, setPosition] = useState({ x: 24, y: window.innerHeight - 80 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => ({
        x: Math.min(prev.x, window.innerWidth - 60),
        y: Math.min(prev.y, window.innerHeight - 60)
      }));
    };
    window.addEventListener("resize", handleResize);
    // Initialize position safely for SSR
    setPosition({ x: 24, y: window.innerHeight - 80 });
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: position.x,
      initY: position.y
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    
    setPosition({
      x: Math.max(0, Math.min(window.innerWidth - 60, dragRef.current.initX + dx)),
      y: Math.max(0, Math.min(window.innerHeight - 60, dragRef.current.initY + dy))
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    // Snap to left edge
    setPosition(prev => ({
      x: prev.x > window.innerWidth / 2 ? window.innerWidth - 72 : 24,
      y: prev.y
    }));
  };

  const handleClick = (e: React.MouseEvent) => {
    if (dragRef.current && (Math.abs(e.clientX - dragRef.current.startX) > 5 || Math.abs(e.clientY - dragRef.current.startY) > 5)) {
      e.preventDefault(); // prevent click if dragged
      return;
    }
    
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <button
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
      className={`fixed z-50 flex items-center justify-center w-12 h-12 rounded-full border border-border/50 bg-background/80 shadow-float backdrop-blur-md cursor-grab active:cursor-grabbing touch-none ${isDragging ? 'scale-110 transition-none' : 'transition-transform duration-300 hover:scale-105 active:scale-95 hover:bg-accent/80'}`}
      style={{ left: position.x, top: position.y }}
      aria-label="Toggle Theme"
    >
      {theme === "dark" ? <Sun className="h-5 w-5 text-yellow-500" /> : <Moon className="h-5 w-5 text-indigo-500" />}
    </button>
  );
}
