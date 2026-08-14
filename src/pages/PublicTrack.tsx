import { Link } from "react-router-dom";
import { ArrowLeft, Package, ShoppingCart, ShieldCheck, Zap } from "lucide-react";
import { TrackOrder } from "@/components/buy/TrackOrder";
import { Logo } from "@/components/Logo";

export default function PublicTrackPage() {
  return (
    <div className="dark relative min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 -z-10 grid-pattern-dark opacity-40" />

      {/* Top Navbar */}
      <nav className="border-b border-border bg-background/95 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4 md:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>

          <Link to="/">
            <Logo size="sm" />
          </Link>

          <Link
            to="/buy"
            className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary transition-colors hover:bg-primary/15"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            Buy Data
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14 space-y-8">
        {/* Header Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
            <Zap className="h-3.5 w-3.5" />
            <span>Live Order Status Tracker</span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Track Telecom Delivery Status
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Enter your phone number or Order Reference ID below to view real-time delivery status and updates.
          </p>
        </div>

        {/* Tracker Card Container */}
        <div className="rounded-[1.75rem] border border-border bg-card p-6 md:p-8">
          <TrackOrder />
        </div>

        {/* Feature Badges */}
        <div className="grid gap-4 sm:grid-cols-3 text-center text-xs">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
            <Zap className="h-5 w-5 text-primary mx-auto" />
            <h4 className="font-semibold text-foreground">Instant Fulfillment</h4>
            <p className="text-[11px] text-muted-foreground">Direct telecom API gateway dispatch</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
            <ShieldCheck className="h-5 w-5 text-emerald-500 mx-auto" />
            <h4 className="font-semibold text-foreground">Auto Refund Protection</h4>
            <p className="text-[11px] text-muted-foreground">Instant wallet credit on order failure</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
            <Package className="h-5 w-5 text-blue-500 mx-auto" />
            <h4 className="font-semibold text-foreground">24/7 Live Sync</h4>
            <p className="text-[11px] text-muted-foreground">Real-time status updates & logs</p>
          </div>
        </div>

        {/* Footer Link */}
        <p className="text-center text-xs text-muted-foreground pt-4">
          Need immediate support?{" "}
          <a
            href="https://wa.me/233500000000"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary hover:underline"
          >
            Chat Support Team
          </a>{" "}
          ·{" "}
          <Link to="/buy" className="font-semibold text-primary hover:underline">
            Order New Package
          </Link>
        </p>
      </div>
    </div>
  );
}
