import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Briefcase,
  Home,
  Package,
  Shield,
  Signal,
  Store,
  TrendingUp,
  User as UserIcon,
  Wallet,
  Zap,
} from "lucide-react";
import { formatGHS, timeAgo } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

const Index = () => {
  const { profile, isAdmin, isAgent, session } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const { data: recent } = useQuery({
    queryKey: ["my-recent-orders", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, reference, status, sell_price, recipient_phone, created_at, bundle:bundles(size_label), network:networks(name, logo_emoji)")
        .eq("customer_user_id", session!.user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  if (!session) {
    nav("/auth", { replace: true });
    return null;
  }

  const greeting = profile?.full_name?.split(" ")[0] || profile?.username || "there";

  const sidebarItems = [
    { label: "Overview", to: "/dashboard", icon: <Home className="h-4 w-4" />, active: loc.pathname === "/dashboard" },
    { label: "Buy Data", to: "/dashboard/buy", icon: <Signal className="h-4 w-4" />, active: loc.pathname === "/dashboard/buy" },
    { label: "Track Orders", to: "/dashboard/track", icon: <Package className="h-4 w-4" />, active: loc.pathname === "/dashboard/track" },
    { label: isAgent ? "My Store" : "Become Agent", to: isAgent ? "/agent" : "/dashboard/agent", icon: <Briefcase className="h-4 w-4" />, active: loc.pathname === "/dashboard/agent" || loc.pathname === "/agent" },
    { label: "Profile", to: "/dashboard/profile", icon: <UserIcon className="h-4 w-4" />, active: loc.pathname === "/dashboard/profile" },
  ];

  return (
    <DashboardLayout
      title={`Welcome back, ${greeting}`}
      subtitle="Monitor activity and manage your workspace."
      badge={isAgent ? "Agent" : "Customer"}
      sidebarHeader={<Logo size="sm" />}
      sidebarItems={sidebarItems}
    >
      <div className="space-y-5">

        {/* ── Hero + quick actions ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Hero card */}
          <div className="relative overflow-hidden rounded-3xl bg-[#080c1a] p-7 shadow-float lg:col-span-8 md:p-9">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-8 left-8 h-32 w-32 rounded-full bg-fuchsia-500/15 blur-2xl" />
            <div className="relative">
              <p className="text-sm font-medium text-white/50">Ready to send data?</p>
              <h2 className="mt-1 text-3xl font-bold leading-tight text-white md:text-4xl">
                Buy in seconds.
              </h2>
              <p className="mt-3 max-w-md text-sm text-white/50">
                Clean checkout, instant confirmation, and reliable delivery from your professional workspace.
              </p>
              <Button asChild className="mt-6 h-11 rounded-xl bg-white px-6 font-bold text-primary hover:bg-white/95 shadow-soft">
                <Link to="/dashboard/buy">
                  <Signal className="mr-1.5 h-4 w-4" /> Buy Data Now
                </Link>
              </Button>
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-3 lg:col-span-4 lg:grid-cols-1">
            <QuickAction icon={<Signal />} label="Buy Data" to="/dashboard/buy" />
            <QuickAction icon={<Package />} label="Track Orders" to="/dashboard/track" />
            <QuickAction icon={<Briefcase />} label={isAgent ? "My Store" : "Become Agent"} to={isAgent ? "/agent" : "/dashboard/agent"} />
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard icon={<Zap />} title="Recent Orders" value={String(recent?.length ?? 0)} helper="Last 5 transactions" />
          <StatCard icon={<TrendingUp />} title="Account Type" value={isAgent ? "Agent" : "Customer"} helper={isAgent ? "Manage your store" : "Upgrade anytime"} />
          <StatCard icon={<Shield />} title="Security" value="Protected" helper="Signed-in session active" />
        </div>

        {/* ── Become Agent CTA (if not agent) ── */}
        {!isAgent && (
          <Link
            to="/dashboard/agent"
            className="group flex w-full items-center gap-4 rounded-3xl border border-primary/20 bg-primary/5 p-5 text-left transition-all hover:border-primary/40 hover:bg-primary/8 hover:shadow-soft"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl gradient-primary shadow-float">
              <Wallet className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-foreground">Earn with OneGig</p>
              <p className="text-sm text-muted-foreground">Open your store · Set prices · Profit on every sale.</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </Link>
        )}

        {/* ── Bottom: orders + account ── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">

          {/* Recent orders */}
          <div className="lg:col-span-8">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Recent activity</p>
            {recent && recent.length > 0 ? (
              <div className="space-y-2">
                {recent.map((o: any) => (
                  <div
                    key={o.id}
                    className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-soft hover:shadow-float transition-shadow"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-lg">
                      {o.network?.logo_emoji || "📶"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">
                        {o.bundle?.size_label} · {o.network?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">to {o.recipient_phone} · {timeAgo(o.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-foreground">{formatGHS(o.sell_price)}</p>
                      <StatusPill status={o.status} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-10 text-center">
                <Signal className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No orders yet</p>
                <p className="mt-1 text-xs text-muted-foreground/60">Tap "Buy Data" above to get started</p>
              </div>
            )}
          </div>

          {/* Account card */}
          <div className="lg:col-span-4">
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft">
              <div className="border-b border-border/60 bg-secondary/30 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Account</p>
              </div>
              <div className="p-5">
                <p className="text-lg font-bold text-foreground">{profile?.full_name || profile?.username || "My profile"}</p>
                <p className="mt-1 text-xs text-muted-foreground">Manage your profile and access links.</p>
                <div className="mt-4 space-y-2">
                  <Button asChild variant="outline" className="w-full h-10 rounded-xl text-sm">
                    <Link to="/dashboard/profile"><UserIcon className="mr-2 h-4 w-4" /> Profile & Settings</Link>
                  </Button>
                  {isAgent && (
                    <Button asChild variant="outline" className="w-full h-10 rounded-xl text-sm">
                      <Link to="/agent"><Store className="mr-2 h-4 w-4" /> Open Agent Store</Link>
                    </Button>
                  )}
                  {isAdmin && (
                    <Button asChild variant="outline" className="w-full h-10 rounded-xl text-sm">
                      <Link to="/admin"><Shield className="mr-2 h-4 w-4" /> Admin Console</Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

function QuickAction({ icon, label, to }: { icon: React.ReactNode; label: string; to: string }) {
  return (
    <Link
      to={to}
      className="group flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card p-4 shadow-soft transition-all hover:shadow-float hover:border-primary/20 active:scale-95"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15 [&_svg]:h-5 [&_svg]:w-5">
        {icon}
      </div>
      <span className="text-xs font-semibold text-foreground">{label}</span>
    </Link>
  );
}

function StatCard({ icon, title, value, helper }: { icon: React.ReactNode; title: string; value: string; helper: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary [&_svg]:h-5 [&_svg]:w-5">
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
        <p className="mt-0.5 text-xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{helper}</p>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    delivered: "bg-success/10 text-success",
    processing: "bg-warning/10 text-warning",
    pending: "bg-muted text-muted-foreground",
    failed: "bg-destructive/10 text-destructive",
    refunded: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${map[status] ?? "bg-muted"}`}>
      {status}
    </span>
  );
}

export default Index;
