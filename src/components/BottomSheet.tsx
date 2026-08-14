import { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "full";
}

export function BottomSheet({ open, onOpenChange, title, description, children, size = "md" }: Props) {
  const heightCls =
    size === "full" ? "h-[95dvh]" : size === "lg" ? "h-[85dvh]" : size === "sm" ? "h-auto max-h-[60dvh]" : "h-auto max-h-[80dvh]";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={`rounded-t-3xl border-t border-border/60 p-0 ${heightCls} overflow-hidden bg-background`}
      >
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted-foreground/20" />
        {(title || description) && (
          <SheetHeader className="px-6 pt-4 pb-2 text-left">
            {title && <SheetTitle className="text-2xl">{title}</SheetTitle>}
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
        )}
        <div className="px-6 pb-8 pt-2 overflow-y-auto h-full">{children}</div>
      </SheetContent>
    </Sheet>
  );
}