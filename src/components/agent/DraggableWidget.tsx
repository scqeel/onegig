import { useState, useRef, useEffect, ReactNode } from "react";

interface Props {
  children: ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  initialPosition?: { x: number; y: number };
}

export function DraggableWidget({ children, onClick, className = "", initialPosition }: Props) {
  const [position, setPosition] = useState(initialPosition || { x: window.innerWidth - 80, y: window.innerHeight - 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => ({
        x: Math.min(prev.x, window.innerWidth - 70),
        y: Math.min(prev.y, window.innerHeight - 70)
      }));
    };
    window.addEventListener("resize", handleResize);
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
    
    // Snap to edge
    setPosition(prev => ({
      x: prev.x > window.innerWidth / 2 ? window.innerWidth - 80 : 20,
      y: prev.y
    }));
  };

  const handleClick = (e: React.MouseEvent) => {
    if (dragRef.current && (Math.abs(e.clientX - dragRef.current.startX) > 5 || Math.abs(e.clientY - dragRef.current.startY) > 5)) {
      e.preventDefault(); // prevent click if dragged
      return;
    }
    if (onClick) onClick(e);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
      className={`fixed z-[100] flex items-center justify-center cursor-grab active:cursor-grabbing touch-none ${isDragging ? 'scale-110 transition-none' : 'transition-transform duration-300'} ${className}`}
      style={{ left: position.x, top: position.y }}
    >
      {children}
    </div>
  );
}
