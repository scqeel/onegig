import { Link, useLocation, useNavigate } from "react-router-dom";
import { Briefcase, Home, LogOut, Mail, Package, Phone, Shield, Signal, Store, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/hooks/useSettings";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

export default function DashboardProfilePage() {
  const nav = useNavigate();
  const loc = useLocation();
  const { profile, isAdmin, isAgent, signOut } = useAuth();
  const { data: settings } = useSettings();

  const sidebarItems = [
    { label: "Overview", to: "/dashboard", icon: <Home className="h-4 w-4" />, active: loc.pathname === "/dashboard" },
    { label: "Buy Data", to: "/dashboard/buy", icon: <Signal className="h-4 w-4" />, active: loc.pathname === "/dashboard/buy" },
    { label: "Track Orders", to: "/dashboard/track", icon: <Package className="h-4 w-4" />, active: loc.pathname === "/dashboard/track" },
    { label: isAgent ? "My Store" : "Become Agent", to: isAgent ? "/agent" : "/dashboard/agent", icon: <Briefcase className="h-4 w-4" />, active: loc.pathname === "/dashboard/agent" || loc.pathname === "/agent" },
    { label: "Profile", to: "/dashboard/profile", icon: <UserIcon className="h-4 w-4" />, active: loc.pathname === "/dashboard/profile" },
  ];

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : (profile?.username?.[0]?.toUpperCase() ?? "U");

  return (
    <DashboardLayout
      title="Profile & Settings"
      subtitle="Manage your account details and quick access links."
      badge="Account"
      sidebarItems={sidebarItems}
    >
      <div className="space-y-4">

        {/* Profile card */}
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
          {/* Dark header */}
          <div className="relative overflow-hidden bg-[#080c1a] px-6 py-8 md:px-8">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative flex items-center gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl gradient-primary text-xl font-bold text-white shadow-float">
                {initials}
              </div>
              <div>
                <p className="text-lg font-bold text-white">{profile?.full_name || profile?.username || "My Account"}</p>
                <p className="mt-0.5 text-sm text-white/50">{profile?.email || "No email set"}</p>
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold text-white/70">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                  {isAgent ? "Agent Account" : "Customer Account"}
                </span>
              </div>
            </div>
          </div>

          {/* Info fields */}
          <div className="p-6 md:p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: UserIcon, label: "Full name", value: profile?.full_name || "—" },
                { icon: UserIcon, label: "Username", value: profile?.username ? `@${profile.username}` : "—" },
                { icon: Phone, label: "Phone", value: profile?.phone || "—" },
                { icon: Mail, label: "Email", value: profile?.email || "—" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3 rounded-xl border border-border/60 bg-secondary/30 p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="mt-6 space-y-2">
              {isAgent && (
                <Button asChild variant="outline" className="w-full h-11 rounded-xl text-sm font-semibold">
                  <Link to="/agent"><Store className="mr-2 h-4 w-4" /> Open Agent Store</Link>
                </Button>
              )}
              {isAdmin && (
                <Button asChild variant="outline" className="w-full h-11 rounded-xl text-sm font-semibold">
                  <Link to="/admin"><Shield className="mr-2 h-4 w-4" /> Admin Console</Link>
                </Button>
              )}
              <Button
                type="button"
                onClick={() => signOut().then(() => nav("/auth"))}
                variant="ghost"
                className="w-full h-11 rounded-xl text-sm font-semibold text-destructive hover:bg-destructive/8 hover:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
            </div>

            {settings?.support_phone && (
              <p className="mt-5 text-center text-xs text-muted-foreground">
                Support: <span className="font-semibold text-foreground">{settings.support_phone}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
