import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Bell, ChevronRight, Gift, Globe, Layers, Loader2, LogOut, Megaphone, Menu, Moon,
  Shield, ShoppingCart, Signal, Store, Sun, Trophy, User, Users, Wallet, X, Zap
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import { useUnreadNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

// Tab Sub-Components
import { AgentPosTab } from "@/components/agent/tabs/AgentPosTab";
import { AgentStoreTab } from "@/components/agent/tabs/AgentStoreTab";
import { AgentMarketingTab } from "@/components/agent/tabs/AgentMarketingTab";
import { AgentLeaderboardTab } from "@/components/agent/tabs/AgentLeaderboardTab";
import { AgentTransactionsTab } from "@/components/agent/tabs/AgentTransactionsTab";
import { CustomerCRM } from "@/components/agent/CustomerCRM";
import { AgentWalletTab } from "@/components/agent/tabs/AgentWalletTab";
import { AgentSubAgentsTab } from "@/components/agent/tabs/AgentSubAgentsTab";
import { AgentSettingsTab } from "@/components/agent/tabs/AgentSettingsTab";

export type AgentTab =
  | "buy"
  | "store"
  | "marketing"
  | "leaderboard"
  | "transactions"
  | "customers"
  | "withdrawals"
  | "sub_agents"
  | "settings";

export const ALL_TABS: { value: AgentTab; label: string; icon: React.ReactNode }[] = [
  { value: "buy",          label: "Sell Data & Bills (POS)", icon: <Signal className="h-4 w-4" /> },
  { value: "store",        label: "My Store",                icon: <Store className="h-4 w-4" /> },
  { value: "marketing",    label: "Marketing Kit",           icon: <Megaphone className="h-4 w-4" /> },
  { value: "leaderboard",  label: "Leaderboard",             icon: <Trophy className="h-4 w-4" /> },
  { value: "transactions", label: "Transactions",            icon: <ShoppingCart className="h-4 w-4" /> },
  { value: "customers",    label: "Customer CRM",            icon: <Users className="h-4 w-4" /> },
  { value: "withdrawals",  label: "Wallet & Cashout",        icon: <Wallet className="h-4 w-4" /> },
  { value: "sub_agents",   label: "Sub-Agents",              icon: <Globe className="h-4 w-4" /> },
  { value: "settings",     label: "Store Settings",          icon: <Layers className="h-4 w-4" /> },
];

// Backwards-compatibility re-exports for SubAgentDashboard
export const BuySection = AgentPosTab;
export const StoreSection = AgentStoreTab;
export const MarketingKitSection = AgentMarketingTab;
export const LeaderboardSection = AgentLeaderboardTab;
export const TransactionsSection = AgentTransactionsTab;
export const WithdrawalsSection = AgentWalletTab;
export const SubAgentsSection = AgentSubAgentsTab;
export const SettingsSection = AgentSettingsTab;

export default function AgentDashboard() {
  const { user, signOut, isAdmin } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<AgentTab>("buy");
  const { theme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: unreadCount } = useUnreadNotifications();
  const [dismissedPrompt, setDismissedPrompt] = useState(false);

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

  useEffect(() => {
    if (agentProfile?.id) {
      setDismissedPrompt(localStorage.getItem(`og_dismiss_setup_${agentProfile.id}`) === "true");
    }
  }, [agentProfile?.id]);

  const initial = agentProfile?.store_name?.[0]?.toUpperCase() ?? "A";
  const isSubAgent = !!agentProfile?.parent_agent_id;
  const TABS = ALL_TABS;

  useEffect(() => {
    if (isSubAgent) {
      nav("/sub-agent", { replace: true });
    }
  }, [isSubAgent, nav]);

  if (isLoading || isSubAgent) {
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

  const showSetupPrompt = 
    (!agentProfile.support_whatsapp || !agentProfile.store_tagline) && 
    !dismissedPrompt && 
    tab !== "settings";

  return (
    <div className="min-h-dvh bg-background">
      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <div className="hidden h-4 w-px bg-border md:block" />
            <span className="hidden text-sm font-bold text-foreground md:block">
              {TABS.find((t) => t.value === tab)?.label ?? "Dashboard"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button asChild variant="outline" size="sm" className="h-8 rounded-lg text-xs">
                <Link to="/admin"><Shield className="mr-1 h-3 w-3" /> Admin</Link>
              </Button>
            )}
            
            <Link 
              to="/dashboard/notifications" 
              aria-label="Notifications" 
              className="relative flex h-8 w-8 items-center justify-center rounded-xl transition-colors hover:bg-secondary/80 text-muted-foreground hover:text-foreground"
            >
              <Bell className="h-4 w-4" />
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
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-soft">
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
          <aside className="sticky top-20 hidden h-fit overflow-hidden rounded-2xl border border-border/60 bg-card shadow-float lg:flex lg:flex-col">
            {/* Agent profile header */}
            <div className="dark relative overflow-hidden bg-background p-4">
              <div className="relative flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground shadow-soft">
                  {initial}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{agentProfile.store_name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">/store/{agentProfile.store_slug}</p>
                </div>
              </div>
              <div className="relative mt-3 flex items-center gap-1.5">
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-400">{isSubAgent ? "Active Sub-Agent" : "Active Agent"}</span>
              </div>
            </div>

            {/* Nav items */}
            <nav className="flex-1 space-y-0.5 p-2">
              {TABS.map((t) => {
                const active = tab === t.value;
                return (
                  <button
                    type="button"
                    key={t.value}
                    onClick={() => setTab(t.value as AgentTab)}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all relative overflow-hidden",
                      active
                        ? "bg-primary/10 text-primary border-l-4 border-primary font-semibold"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground hover:translate-x-1"
                    )}
                  >
                    <span className={cn("shrink-0 transition-transform duration-300", active ? "text-primary scale-110" : "group-hover:scale-110")}>{t.icon}</span>
                    <span className="flex-1">{t.label}</span>
                    {active && <ChevronRight className="h-3.5 w-3.5 text-primary opacity-80 animate-in slide-in-from-left-2 duration-300" />}
                  </button>
                );
              })}
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
          <main className="min-w-0 w-full animate-in fade-in duration-300">
            {showSetupPrompt && (
              <div className="mb-6 p-5 rounded-2xl border border-amber-500/25 bg-amber-500/5 flex items-start justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 shadow-inner">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-amber-600 dark:text-amber-400">⚡ Complete your store setup!</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Customize your store tagline, add a WhatsApp support contact, and set up your wholesale bundle prices under Settings to start selling successfully.
                    </p>
                    <button
                      type="button"
                      onClick={() => setTab("settings")}
                      className="mt-2 text-xs font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                    >
                      Configure store settings →
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem(`og_dismiss_setup_${agentProfile.id}`, "true");
                    setDismissedPrompt(true);
                  }}
                  className="rounded-xl p-1.5 text-muted-foreground/40 hover:bg-secondary/80 hover:text-foreground transition-colors shrink-0"
                  aria-label="Dismiss prompt"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            
            {tab === "buy"          && <AgentPosTab agentProfile={agentProfile} />}
            {tab === "store"        && <AgentStoreTab agentProfile={agentProfile} userId={user?.id} />}
            {tab === "marketing"    && <AgentMarketingTab agentProfile={agentProfile} />}
            {tab === "leaderboard"  && <AgentLeaderboardTab agentProfile={agentProfile} />}
            {tab === "transactions" && <AgentTransactionsTab agentId={agentProfile.id} />}
            {tab === "customers"    && <CustomerCRM />}
            {tab === "withdrawals"  && <AgentWalletTab userId={user?.id!} />}
            {tab === "sub_agents"   && <AgentSubAgentsTab agentProfile={agentProfile} />}
            {tab === "settings"     && <AgentSettingsTab agentProfile={agentProfile} />}
          </main>
        </div>
      </div>

      {/* ── Mobile bottom bar (Modern Floating Pill) ── */}
      <nav className="fixed bottom-4 left-4 right-4 z-40 lg:hidden pointer-events-none">
        <div className="mx-auto flex h-16 max-w-md items-center justify-between rounded-full border border-border bg-card px-4 shadow-float pointer-events-auto transition-all">
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
                  active ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && (
                  <span className="absolute -top-3 h-1 w-8 rounded-full bg-primary animate-in zoom-in" />
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
                className="relative flex flex-1 flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground transition-all duration-300"
              >
                <Menu className="h-5 w-5" />
                <span className="text-[10px] font-semibold">Menu</span>
              </button>
            </DrawerTrigger>
            <DrawerContent className="bg-background border-border rounded-t-2xl">
              <DrawerHeader className="border-b border-border pb-4">
                <DrawerTitle className="text-left text-lg font-bold tracking-tight">All Tools</DrawerTitle>
                <DrawerDescription className="sr-only">Access all dashboard tools and settings</DrawerDescription>
              </DrawerHeader>
              <div className="p-4 grid grid-cols-3 gap-4 pb-12">
                {TABS.map((t) => {
                  const active = tab === t.value;
                  return (
                    <button
                      type="button"
                      key={t.value}
                      onClick={() => {
                        setTab(t.value as AgentTab);
                        setMenuOpen(false);
                      }}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-2xl p-4 transition-all duration-300",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground border border-border hover:bg-accent"
                      )}
                    >
                      <span className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl transition-all",
                        active ? "bg-primary-foreground/20" : "bg-background"
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
