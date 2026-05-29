import { Link } from "react-router-dom";
import { ArrowLeft, Package, ShoppingCart, Wifi } from "lucide-react";
import { TrackOrder } from "@/components/buy/TrackOrder";

export default function PublicTrackPage() {
  return (
    <div className="relative min-h-screen">
      {/* Background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-background via-background to-primary/5" />
      <div
        className="fixed inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,transparent,transparent 24px,currentColor 24px,currentColor 25px)," +
            "repeating-linear-gradient(90deg,transparent,transparent 24px,currentColor 24px,currentColor 25px)",
        }}
      />

      {/* Top nav */}
      <nav className="border-b border-border/30 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4 md:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/15">
              <Wifi className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm font-black">OneGig</span>
          </div>

          <Link
            to="/buy"
            className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
          >
            <ShoppingCart className="h-3 w-3" />
            Buy Data
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="mx-auto max-w-2xl px-5 py-12 md:px-8 md:py-16">
        {/* Hero */}
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5">
            <Package className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-black uppercase tracking-widest text-primary">Order Tracker</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-foreground md:text-5xl">
            Track your order
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            Enter the phone number used when you bought your data bundle.
          </p>
        </div>

        {/* Card */}
        <div className="overflow-hidden rounded-3xl border border-border/50 bg-card/80 shadow-float backdrop-blur-md">
          <div className="p-6 md:p-8">
            <TrackOrder />
          </div>
        </div>

        {/* Footer note */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Can't find your order?{" "}
          <a href="https://wa.me/233" className="font-semibold text-primary hover:underline">
            Chat support
          </a>{" "}
          ·{" "}
          <Link to="/buy" className="font-semibold text-primary hover:underline">
            Buy data now
          </Link>
        </p>
      </div>
    </div>
  );
}
