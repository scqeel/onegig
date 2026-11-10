import { Link } from "react-router-dom";
import { Search, ShoppingCart } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

/** Top bar shared by the buy and track pages. Shows a link to whichever page you are not on. */
export function PublicHeader({ current }: { current: "buy" | "track" }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95">
      {/* Right padding keeps the links clear of the floating theme toggle on narrower screens. */}
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between pl-3 pr-16 md:pl-6 xl:pr-6">
        <Link to="/" aria-label="OneGig home">
          <Logo size="sm" />
        </Link>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm" className="h-9 gap-1.5 rounded-xl px-2 text-xs font-semibold text-muted-foreground hover:text-foreground sm:px-3">
            {current === "buy" ? (
              <Link to="/track">
                <Search className="h-3.5 w-3.5" /> Track Order
              </Link>
            ) : (
              <Link to="/buy">
                <ShoppingCart className="h-3.5 w-3.5" /> Buy Data
              </Link>
            )}
          </Button>
          <Button asChild variant="outline" size="sm" className="h-9 whitespace-nowrap rounded-xl px-2.5 text-xs font-semibold sm:px-3">
            <Link to="/auth?tab=signin">Agent Sign In</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
