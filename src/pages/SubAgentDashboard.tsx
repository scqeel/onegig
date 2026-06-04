import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Loader2, LogOut, Moon, Sun, User, Store, Gift, Bell, Signal, Wallet, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { CustomerCRM } from "@/components/agent/CustomerCRM";
import { useUnreadNotifications } from "@/hooks/useNotifications";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerDescription
} from "@/components/ui/drawer";
import { BuySection, StoreSection, MarketingKitSection, LeaderboardSection, TransactionsSection, WithdrawalsSection, SubAgentsSection, SettingsSection, ALL_TABS, AgentTab } from "./AgentDashboard";

export default function SubAgentDashboard() {
  const [tab, setTab] = useState<AgentTab>("buy");
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const isNotifications = location.pathname === "/dashboard/notifications";
  const { theme, setTheme } = useTheme();
  const { data: unreadCount } = useUnreadNotifications();

  const { data: agentProfile, isLoading } = useQuery({
    queryKey: ["my-agent-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data as any;
    },
  });

  const { data: parentAgent } = useQuery({
    queryKey: ["parent-agent-profile", agentProfile?.parent_agent_id],
    enabled: !!agentProfile?.parent_agent_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_profiles")
        .select("store_name, store_slug, store_logo_url, store_brand_color")
        .eq("id", agentProfile!.parent_agent_id)
        .maybeSingle();
      return data as any;
    },
  });

  const initial = agentProfile?.store_name?.[0]?.toUpperCase() ?? "A";
  const parentInitial = parentAgent?.store_name?.[0]?.toUpperCase() ?? "A";
  const brandColor = parentAgent?.store_brand_color || "#7c3aed";
  const storeName = parentAgent?.store_name || "Data Platform";
  const isSubAgent = !!agentProfile?.parent_agent_id;

  useEffect(() => {
    if (agentProfile && !isSubAgent) {
      nav("/agent", { replace: true });
    }
  }, [agentProfile, isSubAgent, nav]);

  if (isLoading || (agentProfile && !isSubAgent)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!agentProfile) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background text-center px-6">
        <Store className="h-12 w-12 text-muted-foreground/30" />
        <p className="font-bold text-foreground">No agent profile found.</p>
        <p className="text-sm text-muted-foreground">Your agent account may not be activated yet.</p>
        <Button variant="outline" onClick={() => nav("/dashboard/agent")} className="rounded-xl">
          Activate Agent Account
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-white/90 backdrop-blur-sm dark:bg-background/90">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3">
            {parentAgent?.store_logo_url ? (
              <img src={parentAgent.store_logo_url} alt={storeName} className="h-7 w-7 rounded-md object-cover" />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-md font-bold text-white text-xs" style={{ backgroundColor: brandColor }}>
                {parentInitial}
              </div>
            )}
            <span className="font-bold text-foreground" style={{ color: theme === 'light' ? brandColor : undefined }}>
              {storeName}
            </span>
            <div className="hidden h-4 w-px bg-border md:block" />
            <span className="hidden text-sm font-bold text-foreground md:block">
              {ALL_TABS.find((t) => t.value === tab)?.label ?? "Dashboard"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link 
              to="/dashboard/notifications" 
              aria-label="Notifications" 
              className={cn(
                "relative flex h-8 w-8 items-center justify-center rounded-xl transition-colors",
                isNotifications ? "bg-primary/10 text-primary" : "hover:bg-secondary/80 text-muted-foreground hover:text-foreground"
              )}
            >
              <Bell className="h-4 w-4 transition-colors" fill={isNotifications ? "currentColor" : "none"} />
              {!!unreadCount && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-background animate-in zoom-in">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle dark mode"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={async () => {
                await signOut();
                nav("/");
              }}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>

            {/* Store badge */}
            <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-secondary/50 py-1 pl-1.5 pr-3 md:flex">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-soft" style={{ backgroundColor: brandColor }}>
                {initial}
              </div>
              <span className="max-w-[120px] truncate text-xs font-semibold text-foreground">
                {agentProfile.store_name}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-5 md:px-8 lg:pb-8">
        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">

          {/* ── Sidebar ── */}
          <aside className="sticky top-20 hidden h-fit overflow-hidden rounded-3xl border border-border/60 bg-card shadow-float lg:flex lg:flex-col">
            {/* Agent profile header */}
            <div className="relative overflow-hidden p-4" style={{ backgroundColor: '#080c1a' }}>
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl" style={{ backgroundColor: brandColor, opacity: 0.2 }} />
              <div className="relative flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-soft" style={{ backgroundColor: brandColor }}>
                  {initial}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{agentProfile.store_name}</p>
                  <p className="truncate text-[10px] text-white/40">/store/{agentProfile.store_slug}</p>
                </div>
              </div>
              <div className="relative mt-3 flex items-center gap-1.5">
                <span className="flex h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] font-bold text-green-400">Active Agent</span>
              </div>
            </div>

            {/* Nav items */}
            <nav className="flex-1 space-y-0.5 p-2">
              {ALL_TABS.map((t) => (
                <button
                  type="button"
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all",
                    tab === t.value
                      ? "text-white shadow-soft"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  )}
                  style={tab === t.value ? { backgroundColor: brandColor } : {}}
                >
                  <span className="shrink-0">{t.icon}</span>
                  <span className="flex-1">{t.label}</span>
                  {tab === t.value && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
                </button>
              ))}
            </nav>

            {/* Footer */}
            <div className="border-t border-border/60 p-2 space-y-0.5">
              <Link
                to="/dashboard/referrals"
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
              >
                <Gift className="h-3.5 w-3.5" /> Refer & Earn
              </Link>
              <Link
                to="/dashboard/profile"
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
              >
                <User className="h-3.5 w-3.5" /> My Profile
              </Link>
              <Link
                to="/"
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to site
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </div>
          </aside>

          {/* ── Main content ── */}
          <main>
            {tab === "buy"          && <BuySection agentProfile={agentProfile} />}
            {tab === "store"        && <StoreSection agentProfile={agentProfile} userId={user?.id} />}
            {tab === "marketing"    && <MarketingKitSection agentProfile={agentProfile} />}
            {tab === "leaderboard"  && <LeaderboardSection agentProfile={agentProfile} />}
            {tab === "transactions" && <TransactionsSection agentId={agentProfile.id} />}
            {tab === "customers"    && <CustomerCRM />}
            {tab === "withdrawals"  && <WithdrawalsSection userId={user?.id!} />}
            {tab === "sub_agents"   && <SubAgentsSection agentProfile={agentProfile} />}
            {tab === "settings"     && <SettingsSection agentProfile={agentProfile} />}
          </main>
        </div>
      </div>

      {/* ── Mobile bottom bar (Modern Floating Pill) ── */}
      <nav className="fixed bottom-4 left-4 right-4 z-40 lg:hidden pointer-events-none">
        <div className="mx-auto flex h-16 max-w-md items-center justify-between rounded-full border border-slate-200/50 bg-white/95 px-4 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/90 pointer-events-auto transition-all">
          {[
            { value: "buy", label: "Buy Data", icon: <Signal className="h-5 w-5" /> },
            { value: "store", label: "My Store", icon: <Store className="h-5 w-5" /> },
            { value: "withdrawals", label: "Wallet", icon: <Wallet className="h-5 w-5" /> },
          ].map((t) => {
            const active = tab === t.value;
            return (
              <button
                type="button"
                key={t.value}
                onClick={() => setTab(t.value as AgentTab)}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-all duration-300",
                  active ? "font-bold" : "text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white"
                )}
                style={active ? { color: brandColor } : {}}
              >
                {active && (
                  <span className="absolute -top-3 h-1 w-8 rounded-full animate-in zoom-in" style={{ backgroundColor: brandColor, boxShadow: `0 0 10px ${brandColor}` }} />
                )}
                <span className="transition-transform duration-300">{t.icon}</span>
                <span className="text-[10px] font-semibold">{t.label}</span>
              </button>
            );
          })}

          <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
            <DrawerTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.currentTarget.blur()}
                className="relative flex flex-1 flex-col items-center justify-center gap-0.5 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all duration-300"
              >
                <Menu className="h-5 w-5" />
                <span className="text-[10px] font-semibold">Menu</span>
              </button>
            </DrawerTrigger>
            <DrawerContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-t-[32px]">
              <DrawerHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <DrawerTitle className="text-left text-lg font-black tracking-tight">All Tools</DrawerTitle>
                <DrawerDescription className="sr-only">Access all dashboard tools and settings</DrawerDescription>
              </DrawerHeader>
              <div className="p-4 grid grid-cols-3 gap-4 pb-12">
                {ALL_TABS.map((t) => {
                  const active = tab === t.value;
                  return (
                    <button
                      type="button"
                      key={t.value}
                      onClick={() => {
                        setTab(t.value);
                        setMenuOpen(false);
                      }}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-2xl p-4 transition-all duration-300",
                        active 
                          ? "text-white shadow-lg" 
                          : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                      )}
                      style={active ? { backgroundColor: brandColor, boxShadow: `0 8px 16px ${brandColor}40` } : {}}
                    >
                      <span className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl transition-all",
                        active ? "bg-white/20" : "bg-white dark:bg-slate-950"
                      )}>
                        {t.icon}
                      </span>
                      <span className="text-[10px] font-bold tracking-tight text-center leading-tight">
                        {t.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </nav>
    </div>
  );
}
