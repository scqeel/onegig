import { ArrowRight, MessageCircle, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface StoreChatMessage {
  sender: "user" | "bot";
  text: string;
}

export function StoreAssistant({
  open,
  onOpenChange,
  messages,
  input,
  onInputChange,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: StoreChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <div className="flex flex-col items-end">
      {open && (
        <div className="mb-4 flex h-96 w-[min(20rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-float animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center justify-between border-b border-border bg-secondary/40 p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold leading-tight text-foreground">Storefront AI</h3>
                <p className="text-[10px] text-muted-foreground">Online & Ready</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Close assistant"
              onClick={() => onOpenChange(false)}
              className="h-7 w-7 rounded-full p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-background/50 p-4">
            {messages.map((m, idx) => (
              <div key={idx} className={cn("flex", m.sender === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3.5 py-2 text-xs font-semibold leading-relaxed",
                    m.sender === "user"
                      ? "rounded-tr-none bg-primary text-primary-foreground"
                      : "rounded-tl-none border border-border bg-card text-foreground",
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 border-t border-border bg-card p-3">
            <Input
              placeholder="Ask me anything..."
              aria-label="Message the assistant"
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSend()}
              className="h-10 rounded-xl text-xs"
            />
            <Button aria-label="Send message" onClick={onSend} className="h-10 rounded-xl px-4">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <button
        type="button"
        aria-label={open ? "Close assistant" : "Open assistant"}
        onClick={() => onOpenChange(!open)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-float transition-transform hover:scale-105 active:scale-95"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    </div>
  );
}
