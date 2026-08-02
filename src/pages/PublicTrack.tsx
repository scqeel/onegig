import { Link } from "react-router-dom";
import { ArrowLeft, Package, ShoppingCart, Wifi, ShieldCheck, Zap } from "lucide-react";
import { TrackOrder } from "@/components/buy/TrackOrder";

export default function PublicTrackPage() {
  return (
    <div className="relative min-h-screen bg-[#070b14] text-slate-100 selection:bg-purple-500 selection:text-white">
      {/* Background Gradients */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />
      <div
        className="fixed inset-0 -z-10 opacity-[0.02]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,transparent,transparent 24px,currentColor 24px,currentColor 25px)," +
            "repeating-linear-gradient(90deg,transparent,transparent 24px,currentColor 24px,currentColor 25px)",
        }}
      />

      {/* Top Navbar */}
      <nav className="border-b border-slate-800/80 bg-[#070b14]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4 md:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>

          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-lg shadow-purple-500/20">
              <Wifi className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-black tracking-tight text-white">OneGig</span>
          </Link>

          <Link
            to="/buy"
            className="flex items-center gap-1.5 rounded-full border border-purple-500/40 bg-purple-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-purple-300 transition-all hover:bg-purple-500/20 hover:scale-[1.02]"
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
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1 text-xs font-black uppercase tracking-widest text-purple-300 shadow-inner">
            <Zap className="h-3.5 w-3.5 text-purple-400 animate-pulse" />
            <span>Live Order Status Tracker</span>
          </div>

          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl">
            Track Telecom Delivery Status
          </h1>
          <p className="text-sm text-slate-400 max-w-md mx-auto font-medium">
            Enter your phone number or Order Reference ID below to view real-time delivery status and updates.
          </p>
        </div>

        {/* Tracker Card Container */}
        <div className="rounded-3xl border border-slate-800 bg-[#0a0f1d]/90 p-6 md:p-8 shadow-2xl backdrop-blur-xl">
          <TrackOrder />
        </div>

        {/* Feature Badges */}
        <div className="grid gap-4 sm:grid-cols-3 text-center text-xs">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-1">
            <Zap className="h-5 w-5 text-purple-400 mx-auto" />
            <h4 className="font-extrabold text-white">Instant Fulfillment</h4>
            <p className="text-[11px] text-slate-400">Direct telecom API gateway dispatch</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-1">
            <ShieldCheck className="h-5 w-5 text-emerald-400 mx-auto" />
            <h4 className="font-extrabold text-white">Auto Refund Protection</h4>
            <p className="text-[11px] text-slate-400">Instant wallet credit on order failure</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-1">
            <Package className="h-5 w-5 text-blue-400 mx-auto" />
            <h4 className="font-extrabold text-white">24/7 Live Sync</h4>
            <p className="text-[11px] text-slate-400">Real-time status updates & logs</p>
          </div>
        </div>

        {/* Footer Link */}
        <p className="text-center text-xs text-slate-500 pt-4">
          Need immediate support?{" "}
          <a
            href="https://wa.me/233500000000"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-purple-400 hover:underline"
          >
            Chat Support Team
          </a>{" "}
          ·{" "}
          <Link to="/buy" className="font-bold text-purple-400 hover:underline">
            Order New Package
          </Link>
        </p>
      </div>
    </div>
  );
}
