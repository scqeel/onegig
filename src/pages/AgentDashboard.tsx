import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  LogOut,
  Moon,
  Package,
  ReceiptText,
  Search,
  Settings2,
  Shield,
  Signal,
  Store,
  Sun,
  TrendingUp,
  User,
  Wallet,
  XCircle,
  Users,
  Network,
  Globe,
  Trophy,
  Award,
  Zap,
  X,
  Activity,
  Eye,
  ShoppingCart,
  Megaphone,
  Gift,
  Paintbrush,
  Menu,
  Bell,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
  DrawerDescription
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BuyDataFlow } from "@/components/buy/BuyDataFlow";
import { CustomerCRM } from "@/components/agent/CustomerCRM";
import { WalletManager } from "@/components/agent/WalletManager";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";
import { formatGHS, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { subscribeToPushNotifications } from "@/lib/push";
import { useUnreadNotifications } from "@/hooks/useNotifications";
import { useAgentBundles } from "@/hooks/useNetworksAndBundles";

export type AgentTab = "buy" | "store" | "marketing" | "leaderboard" | "transactions" | "customers" | "withdrawals" | "sub_agents" | "settings";

export const ALL_TABS: { label: string; value: AgentTab; icon: React.ReactNode }[] = [
  { label: "Buy Data",     value: "buy",          icon: <Signal className="h-4 w-4" /> },
  { label: "My Store",     value: "store",         icon: <Store className="h-4 w-4" /> },
  { label: "Marketing Kit",value: "marketing",     icon: <Megaphone className="h-4 w-4" /> },
  { label: "Leaderboard",  value: "leaderboard",   icon: <Trophy className="h-4 w-4" /> },
  { label: "Transactions", value: "transactions",  icon: <ReceiptText className="h-4 w-4" /> },
  { label: "Address Book", value: "customers",     icon: <Users className="h-4 w-4" /> },
  { label: "Wallet & Topup",value: "withdrawals",   icon: <Wallet className="h-4 w-4" /> },
  { label: "Sub-Agents",   value: "sub_agents",    icon: <Network className="h-4 w-4" /> },
  { label: "Settings",     value: "settings",      icon: <Settings2 className="h-4 w-4" /> },
];

export default function AgentDashboard() {
  const [tab, setTab] = useState<AgentTab>("buy");
  const { user, isAdmin, signOut } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const isNotifications = location.pathname === "/dashboard/notifications";
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
  
  // Use all tabs so sub-agents can also recruit!
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
      <header className="sticky top-0 z-30 border-b border-border/60 bg-white/90 backdrop-blur-sm dark:bg-background/90">
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
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full gradient-primary text-[10px] font-bold text-white shadow-soft">
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
            <div className="relative overflow-hidden bg-[#080c1a] p-4">
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
              <div className="relative flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl gradient-primary text-xl font-bold text-white shadow-soft">
                  {initial}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{agentProfile.store_name}</p>
                  <p className="truncate text-[10px] text-white/40">/store/{agentProfile.store_slug}</p>
                </div>
              </div>
              <div className="relative mt-3 flex items-center gap-1.5">
                <span className="flex h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] font-bold text-green-400">{isSubAgent ? "Active Sub-Agent" : "Active Agent"}</span>
              </div>
            </div>

            {/* Nav items */}
            <nav className="flex-1 space-y-0.5 p-2">
              {TABS.map((t) => (
                <button
                  type="button"
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all",
                    tab === t.value
                      ? "gradient-primary text-primary-foreground shadow-soft"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  )}
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
          <main className="min-w-0 w-full animate-in fade-in duration-300">
            {showSetupPrompt && (
              <div className="mb-6 p-5 rounded-[2rem] glass-card border-amber-500/25 bg-amber-500/5 flex items-start justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
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
        <div className="mx-auto flex h-16 max-w-md items-center justify-between rounded-full border border-white/20 bg-black/80 px-4 shadow-2xl backdrop-blur-xl pointer-events-auto">
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
                  "relative flex flex-1 flex-col items-center justify-center gap-1 transition-all duration-300",
                  active ? "text-white" : "text-white/50 hover:text-white/80"
                )}
              >
                {active && (
                  <span className="absolute -top-3 h-1 w-8 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
                )}
                <span className={cn("transition-transform", active && "-translate-y-1")}>{t.icon}</span>
                <span className={cn("text-[10px] font-medium transition-all", active ? "opacity-100" : "opacity-0 absolute translate-y-4")}>{t.label}</span>
              </button>
            );
          })}

          <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
            <DrawerTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.currentTarget.blur()}
                className="relative flex flex-1 flex-col items-center justify-center gap-1 text-white/50 hover:text-white/80 transition-all duration-300"
              >
                <Menu className="h-5 w-5" />
                <span className="text-[10px] font-medium opacity-0 absolute translate-y-4">Menu</span>
              </button>
            </DrawerTrigger>
            <DrawerContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-t-[32px]">
              <DrawerHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <DrawerTitle className="text-left text-lg font-black tracking-tight">All Tools</DrawerTitle>
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
                        setTab(t.value);
                        setMenuOpen(false);
                      }}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-2xl p-4 transition-all duration-300",
                        active 
                          ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25" 
                          : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                      )}
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

// ── Buy ──────────────────────────────────────────────────────────────────────

export function BuySection({ agentProfile }: { agentProfile: any }) {
  const { data: myPrices } = useAgentBundles(agentProfile.id);

  return (
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
      <div className="border-b border-border/60 bg-[#080c1a] px-5 py-4 md:px-6">
        <h2 className="text-base font-bold text-white">Buy Data (Point of Sale)</h2>
        <p className="mt-0.5 text-xs text-white/50">Purchases here apply your retail pricing and generate store analytics.</p>
      </div>
      <div className="p-5 md:p-6">
        <BuyDataFlow agentSlug={agentProfile.store_slug} priceOverrides={myPrices || undefined} />
      </div>
    </div>
  );
}

// ── Store ────────────────────────────────────────────────────────────────────

export function StoreSection({ agentProfile, userId }: { agentProfile: any; userId?: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const storeUrl = `${window.location.origin}/store/${agentProfile.store_slug}`;
  const [copied, setCopied] = useState(false);

  const copyUrl = () => {
    navigator.clipboard.writeText(storeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Real-time Traffic Analytics query
  const { data: analytics, isLoading: loadingAnalytics } = useQuery({
    queryKey: ["agent-store-analytics", agentProfile.id],
    queryFn: async () => {
      const { data: events, error } = await supabase
        .from("storefront_analytics")
        .select("*")
        .eq("agent_id", agentProfile.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching analytics:", error);
        return { events: [], pageViews: 0, checkouts: 0, successes: 0, uniqueVisitors: 0 };
      }

      const pageViews = (events ?? []).filter(e => e.event_type === "page_view").length;
      const checkouts = (events ?? []).filter(e => e.event_type === "checkout_initiated").length;
      const successes = (events ?? []).filter(e => e.event_type === "payment_success").length;

      const uniqueTokens = new Set((events ?? []).map(e => e.session_token));
      const uniqueVisitors = uniqueTokens.size;

      return {
        events: events ?? [],
        pageViews,
        checkouts,
        successes,
        uniqueVisitors
      };
    },
    refetchInterval: 5000, // Live real-time updates!
  });

  const { data: payload, isLoading } = useQuery({
    queryKey: ["agent-store-bundles", agentProfile.id],
    queryFn: async () => {
      const [{ data: networks }, { data: bundles }, { data: myPrices }] = await Promise.all([
        supabase.from("networks").select("id, name, code, logo_emoji").eq("active", true).order("sort_order"),
        supabase.from("bundles").select("id, network_id, size_label, size_mb, base_price").eq("active", true).order("size_mb", { ascending: true }),
        supabase.from("agent_bundle_prices").select("bundle_id, sell_price, active").eq("agent_id", agentProfile.id),
      ]);
      const priceMap: Record<string, number> = {};
      (myPrices ?? []).forEach((r: any) => { if (r.active) priceMap[r.bundle_id] = Number(r.sell_price); });
      return { networks: networks ?? [], bundles: bundles ?? [], priceMap };
    },
  });

  const [prices, setPrices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [targetProfit, setTargetProfit] = useState(500);

  // Promo Coupon Code States & Actions
  const { data: coupons = [], isLoading: loadingCoupons, refetch: refetchCoupons } = useQuery({
    queryKey: ["agent-coupons", agentProfile.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("coupons")
        .select("*")
        .eq("agent_id", agentProfile.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newDiscount, setNewDiscount] = useState("");
  const [newMaxUses, setNewMaxUses] = useState("100");
  const [isCreatingCoupon, setIsCreatingCoupon] = useState(false);

  const toggleCouponActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("coupons")
        .update({ active: !currentStatus })
        .eq("id", id);
      if (error) throw error;
      toast({ title: `Coupon ${currentStatus ? "deactivated" : "activated"} successfully!` });
      refetchCoupons();
    } catch (e: any) {
      toast({ title: "Failed to update coupon status", variant: "destructive" });
    }
  };

  const deleteCoupon = async (id: string) => {
    try {
      const { error } = await supabase
        .from("coupons")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Coupon deleted successfully!" });
      refetchCoupons();
    } catch (e: any) {
      toast({ title: "Failed to delete coupon", variant: "destructive" });
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newDiscount || !newMaxUses) return;

    setIsCreatingCoupon(true);
    try {
      const cleanCode = newCode.trim().toUpperCase();
      const discount = Number(newDiscount);
      const maxUses = parseInt(newMaxUses);

      if (discount <= 0) {
        toast({ title: "Discount must be greater than 0", variant: "destructive" });
        setIsCreatingCoupon(false);
        return;
      }

      if (maxUses <= 0) {
        toast({ title: "Max uses must be greater than 0", variant: "destructive" });
        setIsCreatingCoupon(false);
        return;
      }

      const minBundlePrice = (payload?.bundles ?? []).reduce((min: number, b: any) => {
        const sell = Number(prices[b.id] ?? b.base_price);
        return sell < min ? sell : min;
      }, 999999);

      if (discount >= minBundlePrice && minBundlePrice !== 999999) {
        toast({
          title: "Coupon discount too high",
          description: `To protect your margins, the discount cannot exceed your cheapest data bundle price (${formatGHS(minBundlePrice)}).`,
          variant: "destructive",
        });
        setIsCreatingCoupon(false);
        return;
      }

      const { error } = await supabase
        .from("coupons")
        .insert({
          code: cleanCode,
          discount_amount: discount,
          max_uses: maxUses,
          agent_id: agentProfile.id,
          active: true
        });

      if (error) {
        if (error.code === "23505") {
          throw new Error("A coupon with this promo code already exists.");
        }
        throw error;
      }

      toast({ title: "Coupon created successfully!" });
      setNewCode("");
      setNewDiscount("");
      setNewMaxUses("100");
      setCreateOpen(false);
      refetchCoupons();
    } catch (e: any) {
      toast({ title: e.message || "Failed to create coupon", variant: "destructive" });
    } finally {
      setIsCreatingCoupon(false);
    }
  };

  useEffect(() => {
    if (payload?.priceMap) {
      const s: Record<string, string> = {};
      Object.entries(payload.priceMap).forEach(([k, v]) => { s[k] = String(v); });
      setPrices(s);
    }
  }, [payload?.priceMap]);

  const savePrices = async () => {
    setSaving(true);
    const rows = (payload?.bundles ?? [])
      .filter((b: any) => prices[b.id] && Number(prices[b.id]) > 0)
      .map((b: any) => ({ agent_id: agentProfile.id, bundle_id: b.id, sell_price: Number(prices[b.id]), active: true }));
    if (rows.length) {
      await supabase.from("agent_bundle_prices").upsert(rows as any, { onConflict: "agent_id,bundle_id" });
    }
    setSaving(false);
    toast({ title: "Prices saved" });
    qc.invalidateQueries({ queryKey: ["agent-store-bundles"] });
  };

  // Funnel calculations
  const totalViews = analytics?.pageViews || 0;
  const totalCheckouts = analytics?.checkouts || 0;
  const totalSuccesses = analytics?.successes || 0;
  const totalVisitors = analytics?.uniqueVisitors || 0;
  
  const checkoutConversion = totalVisitors > 0 
    ? Math.round((totalSuccesses / totalVisitors) * 100) 
    : 0;

  return (
    <div className="space-y-4">
      {/* ── STORE TRAFFIC ANALYTICS HUB ── */}
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="border-b border-border/60 bg-[#080c1a] px-5 py-4 md:px-6 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="h-4.5 w-4.5 text-rose-500 animate-pulse" /> Live Storefront Traffic Analytics
            </h2>
            <p className="mt-0.5 text-xs text-white/50">Monitor storefront traffic, conversion funnel, and live visitor activity.</p>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-500 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" /> Realtime
          </span>
        </div>

        <div className="p-5 md:p-6 space-y-6">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                <Users className="h-3.5 w-3.5 text-primary" /> Unique Visitors
              </div>
              <p className="mt-2 text-2xl font-black text-foreground tabular-nums">{loadingAnalytics ? "..." : totalVisitors}</p>
            </div>
            
            <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                <Eye className="h-3.5 w-3.5 text-blue-500" /> Total Page Views
              </div>
              <p className="mt-2 text-2xl font-black text-foreground tabular-nums">{loadingAnalytics ? "..." : totalViews}</p>
            </div>

            <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                <ShoppingCart className="h-3.5 w-3.5 text-amber-500" /> Checkout Started
              </div>
              <p className="mt-2 text-2xl font-black text-foreground tabular-nums">{loadingAnalytics ? "..." : totalCheckouts}</p>
            </div>

            <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> Conversion Rate
              </div>
              <p className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{loadingAnalytics ? "..." : `${checkoutConversion}%`}</p>
            </div>
          </div>

          {/* Funnel Progress Bars */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Storefront Conversion Funnel</h3>
            <div className="space-y-2.5">
              {/* pageview */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-muted-foreground flex items-center gap-1"><Eye className="h-3 w-3" /> Page Views</span>
                  <span className="font-bold tabular-nums">{totalViews}</span>
                </div>
                <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden p-px">
                  <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: totalViews > 0 ? "100%" : "0%" }} />
                </div>
              </div>

              {/* checkouts */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-muted-foreground flex items-center gap-1"><ShoppingCart className="h-3 w-3" /> Initiated Checkouts</span>
                  <span className="font-bold tabular-nums">
                    {totalCheckouts} {totalViews > 0 ? `(${Math.round((totalCheckouts / totalViews) * 100)}%)` : ""}
                  </span>
                </div>
                <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden p-px">
                  <div className="h-full rounded-full bg-amber-500 transition-all duration-500" style={{ width: totalViews > 0 ? `${(totalCheckouts / totalViews) * 100}%` : "0%" }} />
                </div>
              </div>

              {/* successes */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Completed Orders</span>
                  <span className="font-bold tabular-nums">
                    {totalSuccesses} {totalCheckouts > 0 ? `(${Math.round((totalSuccesses / totalCheckouts) * 100)}%)` : ""}
                  </span>
                </div>
                <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden p-px">
                  <div className="h-full rounded-full bg-emerald-505 bg-emerald-500 transition-all duration-500" style={{ width: totalCheckouts > 0 ? `${(totalSuccesses / totalCheckouts) * 100}%` : "0%" }} />
                </div>
              </div>
            </div>
          </div>

          {/* LIVE ACTIVITY TICKER */}
          <div className="border-t border-border/60 pt-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-widest flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" /> Live Storefront Activity Feed
            </h3>
            
            {loadingAnalytics ? (
              <div className="py-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : !analytics?.events || analytics.events.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No recent visitor activity logged yet.</p>
            ) : (
              <div className="h-40 overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-secondary scrollbar-track-transparent">
                {analytics.events.map((e: any, idx: number) => {
                  let text = "Someone visited your store";
                  let bg = "bg-secondary/40";
                  let border = "border-border/30";
                  
                  if (e.event_type === "checkout_initiated") {
                    const metadata = e.metadata || {};
                    text = `Checkout started for ${metadata.network || "Bundle"} ${metadata.size_label || ""}`;
                    bg = "bg-amber-500/5";
                    border = "border-amber-500/20";
                  } else if (e.event_type === "payment_success") {
                    const metadata = e.metadata || {};
                    text = `🎉 SUCCESSFUL ORDER! Purchased ${metadata.network || "Bundle"} ${metadata.size_label || ""} for GH₵${metadata.amount || ""}`;
                    bg = "bg-emerald-500/10";
                    border = "border-emerald-500/30";
                  }
                  
                  return (
                    <div 
                      key={e.id || idx} 
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all hover:scale-[1.01] ${bg} ${border}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{text}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0 ml-4">
                        <Clock className="h-3 w-3" /> {timeAgo(e.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Store link */}
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
        <div className="border-b border-border/60 bg-[#080c1a] px-5 py-4 md:px-6">
          <h2 className="text-base font-bold text-white">Store Link</h2>
          <p className="mt-0.5 text-xs text-white/50">Share this link — customers buy without signing up.</p>
        </div>
        <div className="p-5 md:p-6">
          <div className="flex items-center gap-2">
            <div className="flex-1 truncate rounded-xl border border-border bg-secondary/40 px-3 py-2.5 font-mono text-sm text-muted-foreground">
              {storeUrl}
            </div>
            <Button type="button" variant="outline" size="sm" className="h-10 shrink-0 rounded-xl px-3" onClick={copyUrl}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
            <a
              href={storeUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Open store in new tab"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border hover:bg-secondary/60 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
        <div className="flex items-center justify-between border-b border-border/60 bg-secondary/30 px-5 py-4 md:px-6">
          <div>
            <h3 className="text-base font-bold text-foreground">Your Pricing</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Your profit = your price − base price</p>
          </div>
          <Button type="button" className="h-9 rounded-xl gradient-primary text-sm font-bold" disabled={saving} onClick={savePrices}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Prices"}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 p-5 md:p-6">
            {/* Profit Calculator & Dynamic Presets */}
            <div className="p-4 rounded-2xl bg-secondary/15 border border-border/40 space-y-4 mb-4">
              <h4 className="text-xs font-black text-foreground uppercase tracking-widest flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-primary" /> Smart Reseller Profit Planner & Markups
              </h4>
              <p className="text-xs text-muted-foreground">
                Automate your storefront markup rates instantly or simulate targets to align your reseller margins with top-performing stores.
              </p>

              {/* Presets Grid */}
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { label: "⚡ Competitive", desc: "+GH₵0.50 Markup", value: 0.5 },
                  { label: "✨ Balanced", desc: "+GH₵1.00 Markup", value: 1.0 },
                  { label: "👑 Max Profit", desc: "+GH₵2.00 Markup", value: 2.0 },
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const newPrices: Record<string, string> = {};
                      (payload?.bundles ?? []).forEach((b: any) => {
                        newPrices[b.id] = (Number(b.base_price) + preset.value).toFixed(2);
                      });
                      setPrices(newPrices);
                      toast({
                        title: `${preset.label} Preset Applied!`,
                        description: `All bundle price inputs set to base price + GH₵ ${preset.value.toFixed(2)}. Make sure to click "Save Prices" to save changes!`,
                      });
                    }}
                    className="flex flex-col items-center justify-center p-3 rounded-xl border border-border bg-card hover:bg-secondary/40 text-center transition-all hover:scale-[1.02]"
                  >
                    <span className="text-xs font-bold text-foreground">{preset.label}</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">{preset.desc}</span>
                  </button>
                ))}
              </div>

              {/* Slider simulation */}
              <div className="space-y-2 pt-2 border-t border-border/30">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-muted-foreground">Target Monthly Profit:</span>
                  <span className="font-black text-primary">GH₵ {targetProfit}</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="50"
                  value={targetProfit}
                  onChange={(e) => setTargetProfit(Number(e.target.value))}
                  className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                />
                
                {/* Simulation Output */}
                <div className="p-3 rounded-xl bg-background/50 border border-border/20 text-xs flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Est. Sales Required (at standard markup):</span>
                  <span className="font-extrabold text-foreground tabular-nums">{Math.ceil(targetProfit / 1.0)} sales / month</span>
                </div>
              </div>
            </div>
            {(payload?.networks ?? []).map((n: any) => {
              const networkBundles = (payload?.bundles ?? []).filter((b: any) => b.network_id === n.id);
              if (!networkBundles.length) return null;
              return (
                <div key={n.id} className="overflow-hidden rounded-2xl border border-border/60 bg-secondary/20">
                  <div className="border-b border-border/60 bg-secondary/40 px-4 py-3">
                    <p className="text-sm font-bold text-foreground">{n.logo_emoji} {n.name}</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                          <th className="px-4 py-2.5 font-semibold">Bundle</th>
                          <th className="px-4 py-2.5 font-semibold">Base</th>
                          <th className="px-4 py-2.5 font-semibold">Your Price</th>
                          <th className="px-4 py-2.5 font-semibold">Profit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {networkBundles.map((b: any) => {
                          const sell = Number(prices[b.id] ?? 0);
                          const profit = sell - Number(b.base_price);
                          return (
                            <tr key={b.id} className="border-b border-border/40 last:border-0 hover:bg-secondary/30 transition-colors">
                              <td className="px-4 py-3 font-semibold">{b.size_label}</td>
                              <td className="px-4 py-3 text-muted-foreground">{formatGHS(b.base_price)}</td>
                              <td className="px-4 py-3">
                                <Input
                                  type="number" min="0" step="0.5"
                                  className="h-8 w-24 rounded-lg text-sm"
                                  value={prices[b.id] ?? ""}
                                  placeholder={String(b.base_price)}
                                  onChange={(e) => setPrices((p) => ({ ...p, [b.id]: e.target.value }))}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <span className={cn("text-xs font-bold", profit > 0 ? "text-green-600" : profit < 0 ? "text-destructive" : "text-muted-foreground")}>
                                  {profit !== 0 ? `${profit > 0 ? "+" : ""}${formatGHS(profit)}` : "—"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── PROMO COUPONS & GIVEAWAY VOUCHERS ── */}
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
        <div className="border-b border-border/60 bg-[#080c1a] px-5 py-4 md:px-6 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Gift className="h-4.5 w-4.5 text-rose-500" /> Promo Coupons & Giveaway Vouchers
            </h3>
            <p className="mt-0.5 text-xs text-white/50">Issue store-specific vouchers sponsored out of your own sales margin.</p>
          </div>
          <Button 
            type="button" 
            className="h-9 rounded-xl gradient-primary text-sm font-bold flex items-center gap-1.5"
            onClick={() => setCreateOpen(true)}
          >
            <Gift className="h-4 w-4" /> Create Coupon
          </Button>
        </div>

        <div className="p-5 md:p-6">
          {loadingCoupons ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : coupons.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary/50">
                <Gift className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground">No storefront coupons yet</p>
                <p className="text-xs text-muted-foreground">Distribute discount codes to customers to drive massive conversion rates!</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border/50 bg-secondary/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/30 text-left text-xs font-semibold text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Promo Code</th>
                    <th className="px-4 py-3 font-semibold">Discount</th>
                    <th className="px-4 py-3 font-semibold">Usage Limit</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c: any) => {
                    const isExhausted = Number(c.current_uses) >= Number(c.max_uses);
                    const isActive = c.active && !isExhausted;
                    return (
                      <tr key={c.id} className="border-b border-border/40 last:border-0 hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold uppercase text-foreground">{c.code}</td>
                        <td className="px-4 py-3 font-bold text-rose-500">{formatGHS(c.discount_amount)}</td>
                        <td className="px-4 py-3 text-muted-foreground font-medium tabular-nums">
                          {c.current_uses} / {c.max_uses} used
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isActive ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-secondary text-muted-foreground border border-border'}`}>
                            {isActive ? "Active" : isExhausted ? "Fully Used" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-7 rounded-lg text-xs ${c.active ? "text-amber-500 hover:text-amber-600 hover:bg-amber-500/10" : "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"}`}
                              onClick={() => toggleCouponActive(c.id, c.active)}
                            >
                              {c.active ? "Deactivate" : "Activate"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 rounded-lg text-xs text-destructive hover:bg-destructive/10"
                              onClick={() => deleteCoupon(c.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* CREATE COUPON DIALOG */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-[94vw] max-w-sm rounded-[32px] border-border p-6 bg-card">
          <DialogHeader>
            <DialogTitle className="text-left text-lg font-black text-foreground flex items-center gap-1.5">
              <Gift className="h-5 w-5 text-rose-500" /> Create Reseller Coupon
            </DialogTitle>
            <DialogDescription className="text-left text-xs text-muted-foreground">
              Vouchers will be deducted from your storefront profit margin per purchase.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCoupon} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-muted-foreground uppercase">Promo Code</label>
              <Input
                placeholder="e.g. VIP5"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="h-11 rounded-2xl border-border text-sm font-semibold uppercase focus-visible:ring-primary"
                required
              />
              <p className="text-[10px] text-muted-foreground">Codes are alphanumeric and case-insensitive.</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-muted-foreground uppercase">Discount (GHS)</label>
              <Input
                type="number"
                step="0.1"
                placeholder="e.g. 5.00"
                value={newDiscount}
                onChange={(e) => setNewDiscount(e.target.value)}
                className="h-11 rounded-2xl border-border text-sm font-semibold focus-visible:ring-primary"
                required
              />
              <p className="text-[10px] text-muted-foreground">This cedi value is deducted from your commission/profit.</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-muted-foreground uppercase">Max Total Uses</label>
              <Input
                type="number"
                placeholder="e.g. 100"
                value={newMaxUses}
                onChange={(e) => setNewMaxUses(e.target.value)}
                className="h-11 rounded-2xl border-border text-sm font-semibold focus-visible:ring-primary"
                required
              />
              <p className="text-[10px] text-muted-foreground">The coupon automatically deactivates after reaching this count.</p>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={isCreatingCoupon}
                className="w-full h-11 rounded-2xl font-bold bg-primary hover:bg-primary/95 text-primary-foreground transition-all flex items-center justify-center gap-1.5"
              >
                {isCreatingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Store Coupon"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Status Badge ─────────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; dot: string; label: string }> = {
    delivered:  { bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400", dot: "bg-emerald-500", label: "Delivered"  },
    paid:       { bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400", dot: "bg-emerald-500", label: "Paid"       },
    approved:   { bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400", dot: "bg-emerald-500", label: "Approved"   },
    pending:    { bg: "bg-amber-500/10  text-amber-600  border-amber-500/20  dark:text-amber-400",  dot: "bg-amber-500",  label: "Pending"    },
    processing: { bg: "bg-sky-500/10   text-sky-600   border-sky-500/20   dark:text-sky-400",    dot: "bg-sky-500",    label: "Processing" },
    failed:     { bg: "bg-rose-500/10  text-rose-600  border-rose-500/20  dark:text-rose-400",   dot: "bg-rose-500",   label: "Failed"     },
    rejected:   { bg: "bg-rose-500/10  text-rose-600  border-rose-500/20  dark:text-rose-400",   dot: "bg-rose-500",   label: "Rejected"   },
  };
  const cfg = map[status] ?? { bg: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground", label: status };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide", cfg.bg)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ── Transactions ──────────────────────────────────────────────────────────────

export function TransactionsSection({ agentId }: { agentId: string }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["agent-transactions", agentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, recipient_phone, status, sell_price, agent_profit, created_at, payment_reference, bundle:bundles(size_label, size_mb), network:networks(name, logo_emoji)")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const list = (orders as any[]) ?? [];
  const delivered  = list.filter((o) => o.status === "delivered").length;
  const inProgress = list.filter((o) => ["pending", "processing"].includes(o.status)).length;
  const failed     = list.filter((o) => o.status === "failed").length;
  const totalProfit = list
    .filter((o) => o.status === "delivered")
    .reduce((s, o) => s + Number(o.agent_profit ?? 0), 0);

  const q = search.trim().toLowerCase();
  const filtered = list
    .filter((o) => {
      if (statusFilter === "in_progress") return ["pending", "processing"].includes(o.status);
      if (statusFilter !== "all") return o.status === statusFilter;
      return true;
    })
    .filter((o) =>
      !q ||
      (o.recipient_phone ?? "").includes(q) ||
      (o.network?.name ?? "").toLowerCase().includes(q) ||
      (o.bundle?.size_label ?? "").toLowerCase().includes(q)
    );

  const FILTERS = [
    { label: "All",         value: "all",         count: list.length },
    { label: "Delivered",   value: "delivered",   count: delivered   },
    { label: "In Progress", value: "in_progress", count: inProgress  },
    { label: "Failed",      value: "failed",      count: failed      },
  ];

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {[
          { label: "Total Orders", value: list.length,        icon: ReceiptText,  iconBg: "bg-primary/10",     iconCl: "text-primary",    valCl: "text-foreground"  },
          { label: "Delivered",    value: delivered,          icon: CheckCircle2, iconBg: "bg-emerald-500/10", iconCl: "text-emerald-500",valCl: "text-emerald-600" },
          { label: "In Progress",  value: inProgress,         icon: Clock,        iconBg: "bg-amber-500/10",   iconCl: "text-amber-500",  valCl: "text-amber-600"   },
          { label: "Failed",       value: failed,             icon: XCircle,      iconBg: "bg-rose-500/10",    iconCl: "text-rose-500",   valCl: "text-rose-600"    },
          { label: "Displayed Profit", value: formatGHS(totalProfit), icon: TrendingUp, iconBg: "bg-green-500/10", iconCl: "text-green-500",  valCl: "text-green-700 dark:text-green-400" },
        ].map(({ label, value, icon: Icon, iconBg, iconCl, valCl }) => (
          <div key={label} className="rounded-2xl border border-border/50 bg-card p-4 shadow-soft">
            <div className={cn("mb-3 flex h-8 w-8 items-center justify-center rounded-xl", iconBg)}>
              <Icon className={cn("h-4 w-4", iconCl)} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">{label}</p>
            <p className={cn("mt-1 text-xl font-black tabular-nums", valCl)}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search phone, network…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-border/60 bg-secondary/40 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>

        <div className="flex shrink-0 gap-1 rounded-xl border border-border/50 bg-secondary/40 p-1 overflow-x-auto hide-scrollbar max-w-full">
          {FILTERS.map(({ label, value, count }) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap",
                statusFilter === value
                  ? "gradient-primary text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
              {count > 0 && (
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                  statusFilter === value ? "bg-white/20 text-white" : "bg-secondary text-muted-foreground"
                )}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-soft">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/60">
              <Package className="h-7 w-7 text-muted-foreground/25" />
            </div>
            <p className="text-sm font-bold text-muted-foreground">
              {list.length === 0 ? "No transactions yet" : "No orders match your filter"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              {list.length === 0
                ? "Share your store link to start receiving orders."
                : "Try adjusting your search or filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border/40 bg-secondary/30">
                  {["Network", "Bundle", "Recipient", "Amount", "Profit", "Status", "When"].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map((o, i) => (
                  <tr
                    key={o.id}
                    className={cn(
                      "group transition-colors hover:bg-primary/[0.025]",
                      i % 2 !== 0 && "bg-secondary/[0.04]"
                    )}
                  >
                    {/* Network */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary/70 text-lg leading-none">
                          {o.network?.logo_emoji ?? "📦"}
                        </div>
                        <p className="text-sm font-semibold text-foreground">{o.network?.name}</p>
                      </div>
                    </td>

                    {/* Bundle */}
                    <td className="px-5 py-4">
                      <span className="rounded-lg bg-secondary/70 px-2.5 py-1 text-xs font-bold text-foreground">
                        {o.bundle?.size_label}
                      </span>
                    </td>

                    {/* Recipient */}
                    <td className="px-5 py-4">
                      <code className="rounded-lg bg-secondary/70 px-2 py-1 text-[11px] font-mono font-semibold text-foreground tracking-tight">
                        {o.recipient_phone}
                      </code>
                    </td>

                    {/* Amount */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <p className="text-sm font-black tabular-nums text-foreground leading-none">{formatGHS(o.sell_price)}</p>
                        {o.payment_reference?.startsWith("WP-") && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1 py-0.5 text-[9px] font-bold text-primary uppercase tracking-wider">
                            <Wallet className="h-2.5 w-2.5" /> Wallet
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Profit */}
                    <td className="px-5 py-4">
                      {Number(o.agent_profit) > 0 ? (
                        <div className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-black text-emerald-600 dark:text-emerald-400">
                          <TrendingUp className="h-3 w-3" />
                          +{formatGHS(o.agent_profit)}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <StatusBadge status={o.status} />
                    </td>

                    {/* Time */}
                    <td className="px-5 py-4">
                      <p className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(o.created_at)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="border-t border-border/30 bg-secondary/20 px-5 py-3">
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-bold text-foreground">{filtered.length}</span> of{" "}
              <span className="font-bold">{list.length}</span> transactions
              {totalProfit > 0 && (
                <> · Profit earned:{" "}
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatGHS(totalProfit)}</span>
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Withdrawals ───────────────────────────────────────────────────────────────

const MOMO_NETWORKS = ["MTN", "Telecel", "AirtelTigo"] as const;

export function WithdrawalsSection({ userId }: { userId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [momoNumber, setMomoNumber] = useState("");
  const [momoName, setMomoName] = useState("");
  const [momoNetwork, setMomoNetwork] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: walletData, isLoading } = useQuery({
    queryKey: ["agent-wallet", userId],
    queryFn: async () => {
      const [balRes, earningsRes, withdrawalsRes] = await Promise.all([
        supabase.rpc("get_wallet_balance", { _user_id: userId }),
        supabase.from("wallet_transactions").select("amount").eq("user_id", userId).eq("type", "earning").eq("status", "completed"),
        supabase.from("withdrawals").select("id, amount, momo_number, momo_name, momo_network, status, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
      ]);
      const balance = Number(balRes.data ?? 0);
      const totalRevenue = (earningsRes.data ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0);
      return { balance, totalRevenue, withdrawals: withdrawalsRes.data ?? [] };
    },
  });

  const requestWithdrawal = async () => {
    const amt = Number(amount);
    if (!amt || amt < 50) { toast({ title: "Minimum withdrawal is GHS 50", variant: "destructive" }); return; }
    if (!momoNumber || !momoName || !momoNetwork) { toast({ title: "Fill in all MoMo details", variant: "destructive" }); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("request-withdrawal", { body: { amount: amt, momo_number: momoNumber, momo_name: momoName, momo_network: momoNetwork } });
    setBusy(false);
    if (error || !data?.ok) { toast({ title: "Withdrawal failed", description: data?.error || error?.message, variant: "destructive" }); return; }
    toast({ title: "Withdrawal requested!", description: "Processed within 24 hours." });
    setAmount(""); setMomoNumber(""); setMomoName(""); setMomoNetwork("");
    qc.invalidateQueries({ queryKey: ["agent-wallet"] });
  };

  return (
    <div className="space-y-4">
      {/* Balance cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="relative overflow-hidden rounded-3xl bg-[#080c1a] p-6 shadow-float">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/20 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40">
              <Wallet className="h-3.5 w-3.5" /> Available Balance
            </div>
            <p className="mt-3 text-4xl font-bold text-white">{isLoading ? "…" : formatGHS(walletData?.balance ?? 0)}</p>
            <p className="mt-1 text-xs text-white/40">Ready to withdraw</p>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" /> Lifetime Wallet Earnings
          </div>
          <p className="mt-3 text-4xl font-bold text-foreground">{isLoading ? "…" : formatGHS(walletData?.totalRevenue ?? 0)}</p>
          <p className="mt-1 text-xs text-muted-foreground">All-time earnings</p>
        </div>
      </div>

      {/* Wallet Manager (Topups) */}
      <WalletManager />

      {/* Withdrawal form */}
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
        <div className="border-b border-border/60 bg-secondary/30 px-5 py-4 md:px-6">
          <h2 className="text-base font-bold text-foreground">Request Withdrawal</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Minimum GHS 50 · Processed within 24 hours.</p>
        </div>
        <div className="p-5 md:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Amount (GHS)</label>
              <Input type="number" min="50" className="h-11 rounded-xl" placeholder="e.g. 100" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">MoMo Network</label>
              <select
                aria-label="MoMo Network"
                value={momoNetwork}
                onChange={(e) => setMomoNetwork(e.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select network</option>
                {MOMO_NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">MoMo Number</label>
              <Input type="tel" inputMode="tel" className="h-11 rounded-xl" placeholder="024 000 0000" value={momoNumber} onChange={(e) => setMomoNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Account Name</label>
              <Input className="h-11 rounded-xl" placeholder="Name on MoMo account" value={momoName} onChange={(e) => setMomoName(e.target.value)} />
            </div>
          </div>
          <Button type="button" className="mt-5 h-11 rounded-xl px-8 font-bold gradient-primary shadow-float" disabled={busy} onClick={requestWithdrawal}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request Withdrawal"}
          </Button>
        </div>
      </div>

      {/* History */}
      {(walletData?.withdrawals?.length ?? 0) > 0 && (
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
          <div className="border-b border-border/60 bg-secondary/30 px-5 py-4 md:px-6">
            <h3 className="text-base font-bold text-foreground">Withdrawal History</h3>
          </div>
          <div className="space-y-2 p-5 md:p-6">
            {(walletData?.withdrawals as any[]).map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/20 p-4 hover:bg-secondary/40 transition-colors">
                <div>
                  <p className="font-bold text-foreground">{formatGHS(w.amount)}</p>
                  <p className="text-xs text-muted-foreground">{w.momo_network} · {w.momo_number} · {w.momo_name}</p>
                </div>
                <div className="text-right">
                  <StatusBadge status={w.status} />
                  <p className="mt-1.5 text-xs text-muted-foreground">{timeAgo(w.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-Agents ──────────────────────────────────────────────────────────────────

export function SubAgentsSection({ agentProfile }: { agentProfile: any }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [selectedSubAgent, setSelectedSubAgent] = useState<any | null>(null);
  const [overrideForm, setOverrideForm] = useState<Record<string, string>>({});
  const [savingOverrides, setSavingOverrides] = useState(false);

  const inviteUrl = `${window.location.origin}/join/${agentProfile.store_slug}`;

  const { data: subAgents, isLoading } = useQuery({
    queryKey: ["agent-sub-agents", agentProfile.id],
    queryFn: async () => {
      const { data: agents, error } = await supabase
        .from("agent_profiles")
        .select("id, user_id, store_name, store_slug, activation_paid, created_at")
        .eq("parent_agent_id", agentProfile.id)
        .order("created_at", { ascending: false });
        
      if (error) {
        console.error("Error fetching sub-agents:", error);
        return [];
      }
      if (!agents || agents.length === 0) return [];

      const userIds = agents.map((a) => a.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", userIds);

      return agents.map((agent) => {
        const profile = profiles?.find((p) => p.id === agent.user_id);
        return {
          ...agent,
          profiles: profile ? { full_name: profile.full_name, phone: profile.phone } : null,
        };
      });
    },
  });

  const copyUrl = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Invite link copied!" });
  };

  // Override rates query
  const { data: overridePayload, isLoading: loadingOverrides } = useQuery({
    queryKey: ["sub-agent-overrides", selectedSubAgent?.id],
    enabled: !!selectedSubAgent?.id,
    queryFn: async () => {
      const [{ data: bundles }, { data: networks }, { data: existing }, { data: myPrices }] = await Promise.all([
        supabase.from("bundles").select("id, network_id, size_label, base_price").eq("active", true).order("size_mb"),
        supabase.from("networks").select("id, name, code, logo_emoji").eq("active", true),
        supabase.from("sub_agent_wholesale_overrides").select("bundle_id, wholesale_price").eq("sub_agent_id", selectedSubAgent!.id).eq("parent_agent_id", agentProfile.id),
        supabase.from("agent_bundle_prices").select("bundle_id, sell_price").eq("agent_id", agentProfile.id).eq("active", true),
      ]);

      const overrideMap: Record<string, number> = {};
      (existing ?? []).forEach((r: any) => {
        overrideMap[r.bundle_id] = Number(r.wholesale_price);
      });

      const parentPriceMap: Record<string, number> = {};
      (myPrices ?? []).forEach((r: any) => {
        parentPriceMap[r.bundle_id] = Number(r.sell_price);
      });

      return {
        bundles: (bundles ?? []).map(b => ({
          ...b,
          network: (networks ?? []).find(n => n.id === b.network_id),
          overridePrice: overrideMap[b.id] || null,
          parentPrice: parentPriceMap[b.id] != null ? parentPriceMap[b.id] : Number(b.base_price),
        }))
      };
    }
  });

  useEffect(() => {
    if (overridePayload?.bundles) {
      const s: Record<string, string> = {};
      overridePayload.bundles.forEach(b => {
        s[b.id] = b.overridePrice != null ? String(b.overridePrice) : "";
      });
      setOverrideForm(s);
    }
  }, [overridePayload?.bundles]);

  const saveOverrides = async () => {
    if (!selectedSubAgent) return;
    setSavingOverrides(true);
    
    try {
      const rows = [];
      const deletes = [];
      
      for (const b of overridePayload?.bundles || []) {
        const val = overrideForm[b.id]?.trim();
        if (val && Number(val) > 0) {
          if (Number(val) < Number(b.base_price)) {
            toast({ 
              title: "Invalid Price", 
              description: `Wholesale price for ${b.size_label} cannot be lower than admin base price of GH₵ ${b.base_price}.`,
              variant: "destructive"
            });
            setSavingOverrides(false);
            return;
          }
          rows.push({
            parent_agent_id: agentProfile.id,
            sub_agent_id: selectedSubAgent.id,
            bundle_id: b.id,
            wholesale_price: Number(val),
          });
        } else {
          deletes.push(b.id);
        }
      }

      if (rows.length > 0) {
        const { error: upsertErr } = await supabase
          .from("sub_agent_wholesale_overrides")
          .upsert(rows, { onConflict: "sub_agent_id,bundle_id" });
        if (upsertErr) throw upsertErr;
      }

      if (deletes.length > 0) {
        const { error: deleteErr } = await supabase
          .from("sub_agent_wholesale_overrides")
          .delete()
          .eq("sub_agent_id", selectedSubAgent.id)
          .eq("parent_agent_id", agentProfile.id)
          .in("bundle_id", deletes);
        if (deleteErr) throw deleteErr;
      }

      toast({ title: "Wholesale rates saved successfully!" });
      setSelectedSubAgent(null);
    } catch (e: any) {
      toast({ title: "Failed to save rates", description: e.message, variant: "destructive" });
    } finally {
      setSavingOverrides(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
        <div className="border-b border-border/60 bg-[#080c1a] px-5 py-4 md:px-6">
          <h2 className="text-base font-bold text-white">Sub-Agents</h2>
          <p className="mt-0.5 text-xs text-white/50">Invite and manage your network of sub-agents.</p>
        </div>
        <div className="p-5 md:p-6 space-y-6">
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-foreground">Your Invite Link</h3>
            <p className="text-xs text-muted-foreground">Share this link to onboard new sub-agents under your account. They will inherit your base pricing initially.</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 truncate rounded-xl border border-border bg-secondary/40 px-3 py-2.5 font-mono text-sm text-muted-foreground">
                {inviteUrl}
              </div>
              <Button type="button" variant="outline" size="sm" className="h-10 shrink-0 rounded-xl px-3" onClick={copyUrl}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-border/60">
            <h3 className="text-sm font-bold text-foreground">Your Network</h3>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : subAgents?.length === 0 ? (
              <div className="text-center py-8">
                <Network className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">No sub-agents yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Share your invite link to start building your network</p>
              </div>
            ) : (
              <div className="space-y-3">
                {subAgents?.map((sa: any) => (
                  <div key={sa.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-secondary/20 hover:border-primary/20 transition-all duration-300">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-foreground">{sa.store_name}</p>
                        {!sa.activation_paid && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 text-[10px] font-bold">Pending Activation</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {sa.profiles?.full_name || 'No Name'} · {sa.profiles?.phone || 'No Phone'}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {sa.activation_paid && (
                        <Button 
                          onClick={() => setSelectedSubAgent(sa)}
                          variant="outline" 
                          size="sm" 
                          className="h-9 px-3 rounded-lg text-xs font-bold bg-white/5 border-border hover:bg-secondary/40 text-foreground"
                        >
                          Wholesale Rates
                        </Button>
                      )}
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Joined {timeAgo(sa.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* advanced wholesale rates modal */}
      <Dialog open={!!selectedSubAgent} onOpenChange={(open) => { if (!open) setSelectedSubAgent(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-foreground">Configure Wholesale Overrides</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Set custom bundle wholesale costs for <span className="font-extrabold text-foreground">{selectedSubAgent?.store_name}</span>.
              Leaving an override empty restores standard pricing (sub-agent pays standard admin base rates).
            </DialogDescription>
          </DialogHeader>

          {loadingOverrides ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-4 pt-4">
              <div className="overflow-hidden rounded-xl border border-border/60 bg-secondary/15">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-secondary/40 border-b border-border/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3">Bundle</th>
                      <th className="px-4 py-3">Base Cost</th>
                      <th className="px-4 py-3">Your Sell Price</th>
                      <th className="px-4 py-3">Sub Wholesale Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {overridePayload?.bundles.map((b: any) => (
                      <tr key={b.id} className="hover:bg-secondary/10 transition-colors">
                        <td className="px-4 py-3.5 font-bold flex items-center gap-1.5">
                          <span className="text-sm shrink-0">{b.network?.logo_emoji}</span>
                          <span>{b.size_label}</span>
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground font-mono">{formatGHS(b.base_price)}</td>
                        <td className="px-4 py-3.5 text-muted-foreground font-mono">{formatGHS(b.parentPrice)}</td>
                        <td className="px-4 py-3.5">
                          <div className="relative w-28">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">GH₵</span>
                            <Input
                              type="number"
                              step="0.1"
                              min={b.base_price}
                              placeholder={b.base_price.toFixed(2)}
                              value={overrideForm[b.id] ?? ""}
                              onChange={e => setOverrideForm(p => ({ ...p, [b.id]: e.target.value }))}
                              className="h-8 pl-10 text-xs rounded-lg font-mono w-full"
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" className="h-10 rounded-xl" onClick={() => setSelectedSubAgent(null)}>
                  Cancel
                </Button>
                <Button 
                  disabled={savingOverrides} 
                  onClick={saveOverrides}
                  className="h-10 px-6 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold"
                >
                  {savingOverrides ? "Saving..." : "Save Wholesale Rates"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────

export function SettingsSection({ agentProfile }: { agentProfile: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    store_name: agentProfile.store_name ?? "",
    store_tagline: agentProfile.store_tagline ?? "",
    store_brand_color: agentProfile.store_brand_color ?? "#7c3aed",
    store_logo_url: agentProfile.store_logo_url ?? "",
    support_whatsapp: agentProfile.support_whatsapp ?? "",
    support_phone: agentProfile.support_phone ?? "",
    custom_domain: agentProfile.custom_domain ?? "",
    store_promo_banner: agentProfile.store_promo_banner ?? "",
    store_promo_banner_style: agentProfile.store_promo_banner_style ?? "neon-flash",
    store_template_theme: agentProfile.store_template_theme ?? "minimalist",
    store_font_family: agentProfile.store_font_family ?? "Inter",
    store_dark_mode: agentProfile.store_dark_mode ?? false,
  });
  const [widgetEnabled, setWidgetEnabled] = useState(() => {
    return localStorage.getItem("og_whatsapp_widget") !== "false";
  });
  const [pushEnabled, setPushEnabled] = useState(Notification.permission === "granted");
  const [saving, setSaving] = useState(false);

  const f = (key: keyof typeof form, val: any) => setForm((p) => ({ ...p, [key]: val }));

  const save = async () => {
    setSaving(true);
    localStorage.setItem("og_whatsapp_widget", String(widgetEnabled));

    if (pushEnabled && Notification.permission !== "granted") {
      const success = await subscribeToPushNotifications(agentProfile.user_id);
      if (success) {
        setPushEnabled(true);
        toast({ title: "Push Notifications Enabled", description: "You will now receive alerts for new sales." });
      } else {
        setPushEnabled(false);
      }
    }

    const { error } = await supabase.from("agent_profiles").update({
      store_name: form.store_name,
      store_tagline: form.store_tagline || null,
      store_brand_color: form.store_brand_color || null,
      store_logo_url: form.store_logo_url || null,
      support_whatsapp: form.support_whatsapp || null,
      support_phone: form.support_phone || null,
      custom_domain: form.custom_domain || null,
      store_promo_banner: form.store_promo_banner || null,
      store_promo_banner_style: form.store_promo_banner_style || "neon-flash",
      store_template_theme: form.store_template_theme,
      store_font_family: form.store_font_family,
      store_dark_mode: form.store_dark_mode,
    } as any).eq("id", agentProfile.id);
    setSaving(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Store settings saved" });
    qc.invalidateQueries({ queryKey: ["my-agent-profile"] });
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
      <div className="border-b border-border/60 bg-[#080c1a] px-5 py-4 md:px-6">
        <h2 className="text-base font-bold text-white">Store Settings</h2>
        <p className="mt-0.5 text-xs text-white/50">Customize how your public store looks and feels.</p>
      </div>

      <div className="p-5 md:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-foreground">Store Name</label>
            <Input className="h-11 rounded-xl" value={form.store_name} onChange={(e) => f("store_name", e.target.value)} placeholder="My Data Store" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-foreground">Tagline <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input className="h-11 rounded-xl" value={form.store_tagline} onChange={(e) => f("store_tagline", e.target.value)} placeholder="Fast & affordable data bundles" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-foreground">Custom Domain <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input className="h-11 rounded-xl" value={form.custom_domain} onChange={(e) => f("custom_domain", e.target.value)} placeholder="e.g. data.mystore.com" />
            <p className="text-[10px] text-muted-foreground mt-1">Point your domain's CNAME or A-record to our platform, then enter the domain here without https://</p>
          </div>
          <div className="space-y-3 md:col-span-2">
            <label className="text-xs font-semibold text-foreground">Logo URL or Select Profile Avatar</label>
            <div className="flex gap-2">
              <Input className="h-11 flex-1 rounded-xl" value={form.store_logo_url.startsWith('data:image/svg+xml') ? 'Emoji Selected' : form.store_logo_url.startsWith('https://api.dicebear.com') ? '3D Avatar Selected' : form.store_logo_url} onChange={(e) => f("store_logo_url", e.target.value)} placeholder="https://example.com/logo.png" readOnly={form.store_logo_url.startsWith('data:image/svg+xml') || form.store_logo_url.startsWith('https://api.dicebear.com')} />
              {(form.store_logo_url.startsWith('data:image/svg+xml') || form.store_logo_url.startsWith('https://api.dicebear.com')) && (
                <Button variant="outline" type="button" onClick={() => f("store_logo_url", "")}>Clear</Button>
              )}
            </div>
            
            {/* 3D Avatars Grid */}
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">3D Avatars</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  "https://api.dicebear.com/9.x/adventurer/svg?seed=Felix",
                  "https://api.dicebear.com/9.x/adventurer/svg?seed=Aneka",
                  "https://api.dicebear.com/9.x/adventurer/svg?seed=Jasper",
                  "https://api.dicebear.com/9.x/adventurer/svg?seed=Max",
                  "https://api.dicebear.com/9.x/adventurer/svg?seed=Bella",
                  "https://api.dicebear.com/9.x/notionists/svg?seed=Leo",
                  "https://api.dicebear.com/9.x/notionists/svg?seed=Zoe",
                  "https://api.dicebear.com/9.x/notionists/svg?seed=Jack",
                  "https://api.dicebear.com/9.x/notionists/svg?seed=Oliver",
                  "https://api.dicebear.com/9.x/notionists/svg?seed=Mia"
                ].map(avatar => (
                  <button
                    key={avatar}
                    type="button"
                    onClick={() => f("store_logo_url", avatar)}
                    className="h-12 w-12 flex items-center justify-center rounded-xl border border-border/50 bg-secondary/30 hover:bg-secondary transition-colors overflow-hidden shadow-sm"
                  >
                    <img src={avatar} alt="Avatar" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Emojis Grid */}
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Emojis</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {["🚀", "💎", "🌟", "🔥", "👑", "⚡", "🎯", "💼", "🛒", "🛍️", "📱", "🛡️", "💰", "💸", "💳", "👨‍💼", "👩‍💼", "🦸‍♂️", "🦹‍♂️", "🦁", "🦅", "😎", "👾", "🦊", "🐻"].map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => f("store_logo_url", `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${emoji}</text></svg>`)}`)}
                    className="h-10 w-10 flex items-center justify-center rounded-xl border border-border/50 bg-secondary/30 hover:bg-secondary transition-colors text-2xl shadow-sm"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Brand Colour</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Brand colour picker"
                title="Brand colour picker"
                value={form.store_brand_color}
                onChange={(e) => f("store_brand_color", e.target.value)}
                className="h-11 w-11 cursor-pointer rounded-xl border border-border bg-background p-1"
              />
              <Input className="h-11 flex-1 rounded-xl" value={form.store_brand_color} onChange={(e) => f("store_brand_color", e.target.value)} placeholder="#7c3aed" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">WhatsApp</label>
            <Input className="h-11 rounded-xl" value={form.support_whatsapp} onChange={(e) => f("support_whatsapp", e.target.value)} placeholder="e.g. 024 000 0000" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Support Phone</label>
            <Input className="h-11 rounded-xl" value={form.support_phone} onChange={(e) => f("support_phone", e.target.value)} placeholder="e.g. 024 000 0000" />
          </div>
          
          <div className="space-y-1.5 md:col-span-2 pt-2 border-t border-border/40">
            <h4 className="text-xs font-black text-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Megaphone className="h-4 w-4 text-rose-500 animate-pulse" /> Top 50 Promo Banner Alert
            </h4>
            <p className="text-[11px] text-muted-foreground">Broadcast high-converting promo alerts at the very top of your storefront page.</p>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-foreground">Promo Announcement Alert Text</label>
            <Input className="h-11 rounded-xl" value={form.store_promo_banner} onChange={(e) => f("store_promo_banner", e.target.value)} placeholder="e.g. ✨ MTN WEEKEND RUSH! MTN 10GB now at GH₵ 11.50 only! Ends Sunday midnight! ⚡" />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-foreground">Promo Ticker Design Theme</label>
            <select
              aria-label="Promo Ticker Design Theme"
              value={form.store_promo_banner_style}
              onChange={(e) => f("store_promo_banner_style", e.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="neon-flash">⚡ Neon Flashing Amber & Rose</option>
              <option value="midnight-gold">👑 Midnight Obsidian & Luxury Gold</option>
              <option value="fire-ruby">🔥 Pulsing Fire Ruby Red</option>
              <option value="success-emerald">✨ Success Emerald Green Pulse</option>
            </select>
          </div>

          <div className="space-y-1.5 md:col-span-2 pt-4 border-t border-border/40">
            <h4 className="text-xs font-black text-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Paintbrush className="h-4 w-4 text-violet-500" /> Premium Theme & Aesthetics Builder
            </h4>
            <p className="text-[11px] text-muted-foreground">Select layouts, custom typographies, and dark modes to command premium reseller rates.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Store Theme Aesthetic</label>
            <select
              aria-label="Store Theme Aesthetic"
              value={form.store_template_theme}
              onChange={(e) => f("store_template_theme", e.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="minimalist">Minimalist Classic</option>
              <option value="glassmorphism">Glassmorphism Translucency</option>
              <option value="cyberpunk">Cyberpunk Neon Grid</option>
              <option value="luxury">Luxury Gold & Stone</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Google Font Typography</label>
            <select
              aria-label="Google Font Typography"
              value={form.store_font_family}
              onChange={(e) => f("store_font_family", e.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="Inter">Inter (Classic Clean)</option>
              <option value="Outfit">Outfit (Geometric Modern)</option>
              <option value="Space Grotesk">Space Grotesk (Tech Accent)</option>
              <option value="Playfair Display">Playfair Display (Serif Elegance)</option>
              <option value="Roboto">Roboto (Standard Friendly)</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-4 bg-secondary/30 border border-border/60 rounded-xl md:col-span-2">
            <div>
              <h4 className="font-bold text-foreground text-sm">Force Dark Mode Style</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Toggle storefront default dark mode (overrides client settings).</p>
            </div>
            <button
              type="button"
              onClick={() => f("store_dark_mode", !form.store_dark_mode)}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${form.store_dark_mode ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${form.store_dark_mode ? 'translate-x-8' : 'translate-x-1'}`} />
            </button>
          </div>
          
          <div className="md:col-span-2 pt-2 space-y-3">
            <div className="flex items-center justify-between p-4 bg-secondary/30 border border-border/60 rounded-xl">
              <div>
                <h4 className="font-bold text-foreground">Draggable WhatsApp Button</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Show a floating chat button on your public storefront.</p>
              </div>
              <button
                onClick={() => setWidgetEnabled(!widgetEnabled)}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${widgetEnabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${widgetEnabled ? 'translate-x-8' : 'translate-x-1'}`} />
              </button>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-secondary/30 border border-border/60 rounded-xl">
              <div>
                <h4 className="font-bold text-foreground">Push Notifications</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Receive native notifications for new sales even when closed.</p>
              </div>
              <button
                onClick={() => setPushEnabled(!pushEnabled)}
                disabled={Notification.permission === "granted"}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${pushEnabled || Notification.permission === "granted" ? 'bg-primary' : 'bg-muted-foreground/30'} disabled:opacity-50`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${pushEnabled || Notification.permission === "granted" ? 'translate-x-8' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </div>

        <Button type="button" className="mt-6 h-11 rounded-xl px-8 font-bold gradient-primary shadow-float" disabled={saving} onClick={save}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}

// ── Leaderboard ──────────────────────────────────────────────────────────────
export function LeaderboardSection({ agentProfile }: { agentProfile: any }) {
  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ["agent-leaderboard"],
    queryFn: async () => {
      // 1. Fetch all active agent profiles
      const { data: agents, error: agentErr } = await supabase
        .from("agent_profiles")
        .select("id, store_name, store_slug, user_id, created_at")
        .eq("activation_paid", true);
        
      if (agentErr) throw agentErr;
      
      // 2. Fetch order counts and volume for completed (delivered) orders
      const { data: orders, error: orderErr } = await supabase
        .from("orders")
        .select("agent_id, sell_price")
        .eq("status", "delivered");
        
      if (orderErr) throw orderErr;
      
      // 3. Aggregate order stats by agent
      const statsMap: Record<string, { count: number; volume: number }> = {};
      (orders ?? []).forEach((o: any) => {
        if (!o.agent_id) return;
        const current = statsMap[o.agent_id] || { count: 0, volume: 0 };
        current.count += 1;
        current.volume += Number(o.sell_price || 0);
        statsMap[o.agent_id] = current;
      });
      
      // 4. Map stats to agent profiles and sort by volume
      return (agents ?? [])
        .map((a: any) => {
          const stats = statsMap[a.id] || { count: 0, volume: 0 };
          return {
            id: a.id,
            store_name: a.store_name,
            store_slug: a.store_slug,
            count: stats.count,
            volume: stats.volume,
          };
        })
        .sort((a, b) => b.volume - a.volume);
    },
  });

  const getTier = (salesCount: number) => {
    if (salesCount >= 1000) return { name: "Elite Reseller", nextTier: "Ultimate Champion", min: 1000, max: 9999, color: "text-rose-500 dark:text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", glow: "shadow-rose-500/10", badge: "👑 Elite" };
    if (salesCount >= 200) return { name: "Platinum Reseller", nextTier: "Elite Reseller", min: 200, max: 1000, color: "text-cyan-500 dark:text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", glow: "shadow-cyan-500/10", badge: "💎 Platinum" };
    if (salesCount >= 50) return { name: "Gold Reseller", nextTier: "Platinum Reseller", min: 50, max: 200, color: "text-yellow-500 dark:text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", glow: "shadow-yellow-500/10", badge: "🏆 Gold" };
    if (salesCount >= 10) return { name: "Silver Reseller", nextTier: "Gold Reseller", min: 10, max: 50, color: "text-slate-400 dark:text-slate-300", bg: "bg-slate-500/10", border: "border-slate-500/20", glow: "shadow-slate-500/10", badge: "⭐ Silver" };
    return { name: "Bronze Reseller", nextTier: "Silver Reseller", min: 0, max: 10, color: "text-amber-600 dark:text-amber-500", bg: "bg-amber-600/10", border: "border-amber-600/20", glow: "shadow-amber-600/10", badge: "🥉 Bronze" };
  };

  const myStats = (leaderboard ?? []).find((x) => x.id === agentProfile.id) || { count: 0, volume: 0 };
  const myRankIndex = (leaderboard ?? []).findIndex((x) => x.id === agentProfile.id);
  const myRank = myRankIndex !== -1 ? myRankIndex + 1 : "—";
  const tier = getTier(myStats.count);
  const progress = Math.min(100, Math.round(((myStats.count - tier.min) / (tier.max - tier.min)) * 100));

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* ── Dashboard Hero Banner with rich gold gamification gradient ── */}
      <div className="relative overflow-hidden rounded-[2rem] border border-amber-500/20 bg-gradient-to-br from-amber-500/15 via-yellow-500/5 to-transparent p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,transparent,transparent 22px,currentColor 22px,currentColor 23px)," +
              "repeating-linear-gradient(90deg,transparent,transparent 22px,currentColor 22px,currentColor 23px)",
          }}
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-xl bg-amber-500/15 px-3.5 py-1 text-amber-600 dark:text-amber-500">
              <Trophy className="h-4 w-4 fill-amber-500/20" />
              <span className="text-[10px] font-black uppercase tracking-widest">Reseller Championship</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">Agent Leaderboard</h2>
            <p className="max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Compete with other reselling agents, boost your sales volume, rank up your reseller tier, and unlock high-tier VIP cashback rewards!
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4 bg-background/40 backdrop-blur-md border border-border/50 rounded-2xl p-4 shadow-soft">
            <div className="text-center px-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Your Rank</p>
              <p className="text-2xl font-black text-amber-500 tabular-nums">#{myRank}</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center px-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Reseller Tier</p>
              <p className={cn("text-sm font-black uppercase", tier.color)}>{tier.name}</p>
            </div>
          </div>
        </div>
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-24 h-20 w-20 rounded-full bg-yellow-500/5 blur-2xl" />
      </div>

      {/* ── Gamified Tier Progress Card ── */}
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Reseller Badge Leveling</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              You have completed <span className="font-bold text-foreground">{myStats.count} sales</span> (GH₵{myStats.volume.toFixed(2)} volume). You are currently a <span className={cn("font-bold", tier.color)}>{tier.name}</span>.
            </p>
          </div>
          <div className="w-full md:w-72 space-y-2">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <span>{tier.name}</span>
              <span>{progress}%</span>
              <span>{tier.nextTier}</span>
            </div>
            <div className="h-3 w-full bg-secondary/50 rounded-full overflow-hidden border border-border/40 p-0.5">
              <div 
                className="h-full rounded-full transition-all duration-1000 gradient-primary relative shadow-glow"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>
            <p className="text-[10px] text-right text-muted-foreground/80 font-medium">
              {tier.max - myStats.count} more sales to reach {tier.nextTier}!
            </p>
          </div>
        </div>
      </div>

      {/* ── Leaderboard Table + Challenge Grid ── */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Standings Table */}
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft lg:col-span-2">
          <div className="border-b border-border/60 bg-secondary/30 px-5 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Top Performing Resellers</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Ranked by complete Reseller Sales Volume (delivered orders)</p>
            </div>
            <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-500 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> Live Stats
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-bold uppercase tracking-widest text-center w-16">Rank</th>
                    <th className="px-5 py-3 font-bold uppercase tracking-widest">Reseller Store</th>
                    <th className="px-5 py-3 font-bold uppercase tracking-widest text-center">Sales</th>
                    <th className="px-5 py-3 font-bold uppercase tracking-widest text-right">Volume</th>
                    <th className="px-5 py-3 font-bold uppercase tracking-widest text-center">Badge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {leaderboard?.map((agent: any, idx: number) => {
                    const rank = idx + 1;
                    const isMe = agent.id === agentProfile.id;
                    const agentTier = getTier(agent.count);
                    
                    return (
                      <tr 
                        key={agent.id} 
                        className={cn(
                          "transition-colors hover:bg-secondary/20",
                          isMe ? "bg-primary/5 hover:bg-primary/10 border-l-4 border-l-primary" : ""
                        )}
                      >
                        <td className="px-5 py-3.5 text-center font-bold tabular-nums">
                          {rank === 1 ? "👑 1" : rank === 2 ? "🥈 2" : rank === 3 ? "🥉 3" : `#${rank}`}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-foreground">
                            {agent.store_name}{" "}
                            {isMe && (
                              <span className="ml-1.5 rounded bg-primary/15 px-1.5 py-0.5 text-[8px] font-black uppercase text-primary tracking-wide">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">/store/{agent.store_slug}</p>
                        </td>
                        <td className="px-5 py-3.5 text-center font-bold tabular-nums text-muted-foreground">
                          {agent.count}
                        </td>
                        <td className="px-5 py-3.5 text-right font-black tabular-nums text-foreground">
                          GH₵{agent.volume.toFixed(2)}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={cn("inline-block rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider", agentTier.bg, agentTier.color, agentTier.border)}>
                            {agentTier.badge}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Challenges Sidebar */}
        <div className="space-y-4">
          {/* Reseller Challenge Card 1 */}
          <div className="overflow-hidden rounded-3xl border border-border/60 bg-card p-5 shadow-soft relative">
            <div className="absolute right-0 top-0 w-24 h-24 rounded-full bg-violet-500/10 blur-xl pointer-events-none" />
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4.5 w-4.5 text-violet-500" />
              <h4 className="font-bold text-foreground text-sm">Active Weekly Reseller Booster</h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Complete at least <span className="font-bold text-foreground">30 delivered sales</span> this week to unlock an extra <span className="font-bold text-green-500">GH₵50 cash boost</span> directly into your reseller wallet!
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                <span>Progress: {myStats.count} / 30</span>
                <span>{Math.min(100, Math.round((myStats.count / 30) * 100))}%</span>
              </div>
              <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden border border-border/40">
                <div 
                  className="h-full rounded-full transition-all duration-1000 bg-violet-500"
                  style={{ width: `${Math.min(100, Math.round((myStats.count / 30) * 100))}%` }}
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-[10px] font-semibold text-muted-foreground border-t border-border/40 pt-3">
              <span>Time remaining: 3 days</span>
              <span className="text-green-500 font-bold uppercase tracking-wider">GH₵50 Reward</span>
            </div>
          </div>

          {/* Reseller Challenge Card 2 */}
          <div className="overflow-hidden rounded-3xl border border-border/60 bg-card p-5 shadow-soft relative">
            <div className="absolute right-0 top-0 w-24 h-24 rounded-full bg-amber-500/10 blur-xl pointer-events-none" />
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4.5 w-4.5 text-amber-500" />
              <h4 className="font-bold text-foreground text-sm">Monthly Volume Champion</h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The agent who achieves the highest reseller volume (GHS) at the end of the month will be crowned the **Volume Champion** and receive a <span className="font-bold text-green-500">GH₵500 mega cash prize!</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Marketing Kit Section ──────────────────────────────────────────────────
export function MarketingKitSection({ agentProfile }: { agentProfile: any }) {
  const { toast } = useToast();
  const [template, setTemplate] = useState<"obsidian" | "neon" | "gold" | "light">("obsidian");
  const [tagline, setTagline] = useState(agentProfile.store_tagline || "Fast & Affordable Data Bundles");
  const [selectedBundles, setSelectedBundles] = useState<string[]>([]);
  const [qrImage, setQrImage] = useState<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const storeUrl = `${window.location.origin}/store/${agentProfile.store_slug}`;

  // Bulk Broadcaster States & Actions
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastType, setBroadcastType] = useState("info");
  const [broadcastSound, setBroadcastSound] = useState("default");
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;

    setIsBroadcasting(true);
    try {
      // 1. Get unique registered customer IDs who placed orders on this store
      const { data: customerOrders, error: orderErr } = await supabase
        .from("orders")
        .select("customer_user_id")
        .eq("agent_id", agentProfile.id)
        .not("customer_user_id", "is", null);

      if (orderErr) throw orderErr;

      const targetUserIds = Array.from(new Set((customerOrders ?? []).map(o => o.customer_user_id)));

      if (targetUserIds.length === 0) {
        toast({
          title: "No registered customers found",
          description: "You don't have any registered storefront buyers with active order histories yet.",
          variant: "destructive"
        });
        setIsBroadcasting(false);
        return;
      }

      // 2. Insert notifications in parallel bulk query
      const notificationRows = targetUserIds.map(userId => ({
        title: broadcastTitle,
        message: broadcastMessage,
        type: broadcastType,
        sound_name: broadcastSound,
        target_user_id: userId,
        is_global: false
      }));

      const { error: insertErr } = await supabase
        .from("app_notifications")
        .insert(notificationRows);

      if (insertErr) throw insertErr;

      toast({
        title: "Broadcast Successful! 📢",
        description: `Your alert has been sent in real-time to all ${targetUserIds.length} registered customers.`,
      });
      setBroadcastTitle("");
      setBroadcastMessage("");
    } catch (err: any) {
      toast({
        title: "Failed to broadcast alert",
        description: err.message || "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setIsBroadcasting(false);
    }
  };

  // Fetch bundles & active pricing
  const { data: payload, isLoading } = useQuery({
    queryKey: ["marketing-kit-bundles", agentProfile.id],
    queryFn: async () => {
      const [{ data: networks }, { data: bundles }, { data: myPrices }] = await Promise.all([
        supabase.from("networks").select("id, name, code, logo_emoji").eq("active", true),
        supabase.from("bundles").select("id, network_id, size_label, base_price").eq("active", true).order("size_mb"),
        supabase.from("agent_bundle_prices").select("bundle_id, sell_price, active").eq("agent_id", agentProfile.id),
      ]);
      
      const priceMap: Record<string, number> = {};
      (myPrices ?? []).forEach((r: any) => { if (r.active) priceMap[r.bundle_id] = Number(r.sell_price); });
      
      return {
        networks: networks ?? [],
        bundles: (bundles ?? []).map(b => ({
          ...b,
          sellPrice: priceMap[b.id] != null ? priceMap[b.id] : Number(b.base_price),
          network: (networks ?? []).find(n => n.id === b.network_id),
        }))
      };
    }
  });

  // Load QR image with CORS support
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(storeUrl)}`;
    img.onload = () => {
      setQrImage(img);
    };
  }, [storeUrl]);

  // Collect the selected bundles details
  const featuredBundles = (payload?.bundles ?? []).filter(b => selectedBundles.includes(b.id)).slice(0, 4);

  // Trigger draw whenever options modify
  useEffect(() => {
    if (payload?.bundles && selectedBundles.length === 0) {
      // Preselect first 4 bundles
      setSelectedBundles(payload.bundles.slice(0, 4).map(b => b.id));
    }
  }, [payload?.bundles]);

  useEffect(() => {
    drawPoster();
  }, [template, tagline, selectedBundles, qrImage, payload]);

  const drawPoster = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 1920);
    if (template === "obsidian") {
      grad.addColorStop(0, "#0b1329");
      grad.addColorStop(0.5, "#1c2541");
      grad.addColorStop(1, "#0d1b2a");
    } else if (template === "neon") {
      grad.addColorStop(0, "#022c22");
      grad.addColorStop(0.5, "#064e3b");
      grad.addColorStop(1, "#022c22");
    } else if (template === "gold") {
      grad.addColorStop(0, "#1c1917");
      grad.addColorStop(0.5, "#0c0a09");
      grad.addColorStop(1, "#1c1917");
    } else if (template === "light") {
      grad.addColorStop(0, "#f8fafc");
      grad.addColorStop(0.5, "#f1f5f9");
      grad.addColorStop(1, "#e2e8f0");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    // Subtle decorative concentric circles
    ctx.strokeStyle = template === "light" ? "rgba(79, 70, 229, 0.04)" : "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 6;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.arc(540, 960, 300 + i * 150, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Theme style configurations
    const textColor = template === "light" ? "#0f172a" : "#ffffff";
    const subColor = template === "light" ? "#475569" : "#94a3b8";
    const accentColor = template === "obsidian" ? "#f43f5e" : template === "neon" ? "#10b981" : template === "gold" ? "#eab308" : "#4f46e5";
    const glassBg = template === "light" ? "rgba(255, 255, 255, 0.9)" : "rgba(15, 23, 42, 0.65)";
    const glassBorder = template === "light" ? "rgba(148, 163, 184, 0.2)" : "rgba(255, 255, 255, 0.1)";

    // Draw header titles
    ctx.textAlign = "center";
    ctx.fillStyle = accentColor;
    ctx.font = "bold 44px sans-serif";
    ctx.fillText("OFFICIAL DATA RESELLER", 540, 180);

    ctx.fillStyle = textColor;
    ctx.font = "extrabold 90px sans-serif";
    ctx.fillText((agentProfile.store_name || "MY DATA STORE").toUpperCase(), 540, 290);

    ctx.fillStyle = subColor;
    ctx.font = "italic 40px sans-serif";
    ctx.fillText(tagline || "Fast & Affordable Data Bundles", 540, 360);

    // Draw price board glassmorphism card
    const cardX = 100;
    const cardY = 460;
    const cardW = 880;
    const cardH = 920;
    const radius = 50;

    ctx.fillStyle = glassBg;
    ctx.strokeStyle = glassBorder;
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(cardX + radius, cardY);
    ctx.lineTo(cardX + cardW - radius, cardY);
    ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + radius);
    ctx.lineTo(cardX + cardW, cardY + cardH - radius);
    ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - radius, cardY + cardH);
    ctx.lineTo(cardX + radius, cardY + cardH);
    ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - radius);
    ctx.lineTo(cardX, cardY + radius);
    ctx.quadraticCurveTo(cardX, cardY, cardX + radius, cardY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Hot pricing card header
    ctx.fillStyle = accentColor;
    ctx.font = "extrabold 50px sans-serif";
    ctx.fillText("TODAY'S SPECIAL RATES", 540, 550);
    
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(340, 580);
    ctx.lineTo(740, 580);
    ctx.stroke();

    // Draw featured list
    const startY = 680;
    const rowGap = 160;

    featuredBundles.forEach((b: any, index: number) => {
      if (index >= 4) return;
      const y = startY + index * rowGap;

      // Draw Row highlight card background
      ctx.fillStyle = template === "light" ? "rgba(0, 0, 0, 0.02)" : "rgba(255, 255, 255, 0.02)";
      ctx.beginPath();
      ctx.roundRect(cardX + 40, y - 60, cardW - 80, 115, 20);
      ctx.fill();

      // Network Badge text
      const logo = b.network?.logo_emoji || "📶";
      ctx.textAlign = "left";
      ctx.fillStyle = textColor;
      ctx.font = "bold 44px sans-serif";
      ctx.fillText(`${logo} ${b.network?.name || "Network"}`, cardX + 70, y + 15);

      // Bundle Size Label
      ctx.fillStyle = subColor;
      ctx.font = "500 40px sans-serif";
      ctx.fillText(b.size_label, cardX + 420, y + 15);

      // Sell Price
      ctx.textAlign = "right";
      ctx.fillStyle = accentColor;
      ctx.font = "extrabold 52px sans-serif";
      ctx.fillText(`GH₵ ${b.sellPrice.toFixed(2)}`, cardX + cardW - 70, y + 15);
    });

    // Draw QR code and "Scan to Buy" footer
    ctx.fillStyle = glassBg;
    ctx.strokeStyle = glassBorder;
    ctx.beginPath();
    ctx.moveTo(cardX + radius, 1440);
    ctx.lineTo(cardX + cardW - radius, 1440);
    ctx.quadraticCurveTo(cardX + cardW, 1440, cardX + cardW, 1440 + radius);
    ctx.lineTo(cardX + cardW, 1820 - radius);
    ctx.quadraticCurveTo(cardX + cardW, 1820, cardX + cardW - radius, 1820);
    ctx.lineTo(cardX + radius, 1820);
    ctx.quadraticCurveTo(cardX, 1820, cardX, 1820 - radius);
    ctx.lineTo(cardX, 1440 + radius);
    ctx.quadraticCurveTo(cardX, 1440, cardX + radius, 1440);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Footer Text
    ctx.textAlign = "left";
    ctx.fillStyle = textColor;
    ctx.font = "extrabold 48px sans-serif";
    ctx.fillText("SCAN TO ORDER INSTANTLY", cardX + 60, 1540);

    ctx.fillStyle = subColor;
    ctx.font = "500 36px sans-serif";
    ctx.fillText("Instant Delivery • No Signup Required", cardX + 60, 1610);

    ctx.fillStyle = accentColor;
    ctx.font = "bold 38px monospace";
    ctx.fillText(storeUrl.replace(/^https?:\/\//, ""), cardX + 60, 1720);

    // Draw QR Code
    if (qrImage) {
      ctx.drawImage(qrImage, cardX + cardW - 320, 1485, 260, 260);
    } else {
      ctx.fillStyle = "rgba(0,0,0,0.1)";
      ctx.fillRect(cardX + cardW - 320, 1485, 260, 260);
      ctx.fillStyle = textColor;
      ctx.textAlign = "center";
      ctx.font = "bold 24px sans-serif";
      ctx.fillText("Loading QR...", cardX + cardW - 190, 1620);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    try {
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${agentProfile.store_slug}_promo_poster.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast({ title: "Social Flyer downloaded successfully!" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Export failed", description: "Your browser security settings prevented canvas export.", variant: "destructive" });
    }
  };

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px] animate-in fade-in zoom-in-95 duration-300">
      
      {/* Visual Canvas Customizer */}
      <div className="space-y-4">
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card p-5 md:p-6 shadow-soft">
          <h2 className="text-base font-bold text-foreground">Marketing Kit Customizer</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Design beautiful WhatsApp status posters and promotional flyers showcasing your cheap data rates.</p>

          <div className="mt-6 space-y-5">
            {/* 1. Theme template selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground uppercase tracking-widest">1. Select Poster Aesthetic</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "obsidian", label: "Obsidian Midnight", color: "bg-slate-900 border-slate-700" },
                  { id: "neon", label: "Glassmorphism Neon", color: "bg-emerald-950 border-emerald-500/30" },
                  { id: "gold", label: "Gold Champion", color: "bg-stone-900 border-yellow-500/30" },
                  { id: "light", label: "Minimalist Light", color: "bg-slate-50 border-slate-200" },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTemplate(t.id as any)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                      template === t.id ? "ring-2 ring-primary border-primary scale-[1.02]" : "hover:bg-secondary/40"
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-full mb-1.5 border ${t.color}`} />
                    <span className="text-[10px] font-bold">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Custom tagline */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground uppercase tracking-widest">2. Tagline Message</label>
              <Input
                value={tagline}
                onChange={e => setTagline(e.target.value)}
                placeholder="Fast & Affordable Data Bundles"
                className="h-11 rounded-xl"
              />
            </div>

            {/* 3. Featured bundles selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground uppercase tracking-widest flex items-center justify-between">
                <span>3. Featured Bundles (Choose Up To 4)</span>
                <span className="text-[10px] text-muted-foreground normal-case font-medium">Selected: {selectedBundles.length} / 4</span>
              </label>

              {isLoading ? (
                <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="max-h-60 overflow-y-auto border border-border/60 rounded-xl divide-y divide-border/40 p-1 bg-secondary/15">
                  {(payload?.bundles ?? []).map((b: any) => {
                    const selected = selectedBundles.includes(b.id);
                    return (
                      <button
                        key={b.id}
                        onClick={() => {
                          if (selected) {
                            setSelectedBundles(p => p.filter(id => id !== b.id));
                          } else {
                            if (selectedBundles.length >= 4) {
                              toast({ title: "Limit reached", description: "You can feature a maximum of 4 bundles.", variant: "destructive" });
                              return;
                            }
                            setSelectedBundles(p => [...p, b.id]);
                          }
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-lg text-left text-xs transition-all ${
                          selected ? "bg-primary/10 text-primary font-bold" : "hover:bg-secondary/40 text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm shrink-0">{b.network?.logo_emoji}</span>
                          <span>{b.network?.name} {b.size_label}</span>
                        </div>
                        <span className="font-extrabold text-foreground">GH₵{b.sellPrice.toFixed(2)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Action Trigger */}
            <Button
              onClick={handleDownload}
              className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 font-extrabold shadow-lg"
            >
              Download Poster (PNG)
            </Button>
          </div>
        </div>
      </div>

      {/* Hidden high-res canvas + live display container */}
      <div className="flex flex-col items-center justify-center p-4 bg-secondary/10 border border-border/60 rounded-3xl min-h-[500px]">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Live Status Preview</p>
        <div className="relative w-[270px] h-[480px] rounded-2xl overflow-hidden shadow-2xl border border-border/80">
          <canvas
            ref={canvasRef}
            width={1080}
            height={1920}
            className="w-full h-full bg-slate-950"
          />
        </div>
      </div>
    </div>

    {/* ── BROADCASTER COMMAND CENTER ── */}
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft mt-6">
      <div className="border-b border-border/60 bg-[#080c1a] px-5 py-4 md:px-6">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Megaphone className="h-4.5 w-4.5 text-rose-500 animate-pulse" /> Live Storefront Broadcaster
        </h2>
        <p className="mt-0.5 text-xs text-white/50">Send real-time alerts and promotional push notifications instantly to all registered storefront buyers.</p>
      </div>

      <div className="p-5 md:p-6 bg-card text-foreground">
        <form onSubmit={handleBroadcast} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Broadcast Title</label>
              <Input
                placeholder="e.g. ✨ Weekend Data Rush!"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                className="h-11 rounded-xl focus:ring-primary text-foreground"
                required
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Notification Message</label>
              <textarea
                placeholder="Write your announcement or discount notification here..."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                className="w-full min-h-[100px] rounded-2xl border border-border bg-transparent px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none text-foreground"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Notification Type</label>
              <select
                value={broadcastType}
                onChange={(e) => setBroadcastType(e.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="info">Info Announcement (Blue)</option>
                <option value="success">Success Chime (Green)</option>
                <option value="warning">Attention Alert (Amber)</option>
                <option value="error">Critical Notification (Red)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Audio Notification Chime</label>
              <select
                value={broadcastSound}
                onChange={(e) => setBroadcastSound(e.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="default">Pop (Default)</option>
                <option value="success">Chime (Success)</option>
                <option value="paystack">Coin Drop (Earning)</option>
                <option value="alert">Siren (Alert)</option>
              </select>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isBroadcasting || !broadcastTitle.trim() || !broadcastMessage.trim()}
            className="mt-2 h-11 px-8 rounded-xl font-bold gradient-primary shadow-float flex items-center justify-center gap-2"
          >
            {isBroadcasting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
            {isBroadcasting ? "Broadcasting Alert..." : "Send Bulk Broadcast Announcement"}
          </Button>
        </form>
      </div>
    </div>

    {/* ── LIVE ORDER PROOF WIDGET ── */}
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft mt-6">
      <div className="border-b border-border/60 bg-[#080c1a] px-5 py-4 md:px-6">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Activity className="h-4.5 w-4.5 text-indigo-400" /> Live Order Proof Widget
        </h2>
        <p className="mt-0.5 text-xs text-white/50">Build customer trust on your external website or blog by showing live MTN data delivery proofs.</p>
      </div>

      <div className="p-5 md:p-6 bg-card text-foreground space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">How it Works</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Display real-time successful MTN data deliveries on your external site. It builds trust and increases conversion rates. Simply copy one of the embed codes below.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Method 1: JavaScript Snippet (Recommended)</h4>
              <p className="text-[11px] text-muted-foreground">Add a container div and include our script. The widget renders inline automatically.</p>
              <div className="relative rounded-xl bg-slate-950 p-3 font-mono text-[10px] text-slate-300">
                <code className="block select-all whitespace-pre-wrap">
                  {`<div id="datahub-mtn-widget"></div>\n<script src="https://user.datahubgh.com/api/widget/last-mtn-delivered?format=script&theme=green"></script>`}
                </code>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Method 2: Iframe Embed</h4>
              <p className="text-[11px] text-muted-foreground">Use an iframe for complete style isolation from your website's CSS.</p>
              <div className="relative rounded-xl bg-slate-950 p-3 font-mono text-[10px] text-slate-300">
                <code className="block select-all whitespace-pre-wrap">
                  {`<iframe\n  src="https://user.datahubgh.com/api/widget/last-mtn-delivered?format=html&theme=green"\n  style="width: 100%; height: 60px; border: none;"\n  scrolling="no"\n></iframe>`}
                </code>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-foreground">Live Widget Preview</h3>
            <div className="rounded-2xl border border-border p-4 bg-secondary/10 flex flex-col gap-3 justify-center min-h-[140px]">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Preview (Green Theme)</p>
              <iframe
                src="https://user.datahubgh.com/api/widget/last-mtn-delivered?format=html&theme=green"
                style={{ width: "100%", height: "60px", border: "none" }}
                scrolling="no"
              />
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2">Preview (Dark Theme)</p>
              <iframe
                src="https://user.datahubgh.com/api/widget/last-mtn-delivered?format=html&theme=dark"
                style={{ width: "100%", height: "60px", border: "none" }}
                scrolling="no"
              />
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Customization parameters</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] text-muted-foreground divide-y divide-border/60">
                  <thead>
                    <tr className="text-foreground font-bold">
                      <th className="pb-1.5 pr-2">Param</th>
                      <th className="pb-1.5 px-2">Options</th>
                      <th className="pb-1.5 px-2">Default</th>
                      <th className="pb-1.5 pl-2">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    <tr>
                      <td className="py-1.5 font-mono pr-2">theme</td>
                      <td className="py-1.5 px-2">green, blue, dark, light</td>
                      <td className="py-1.5 px-2 font-mono">dark</td>
                      <td className="py-1.5 pl-2">Color style aesthetic</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 font-mono pr-2">icon</td>
                      <td className="py-1.5 px-2">true, false</td>
                      <td className="py-1.5 px-2 font-mono">true</td>
                      <td className="py-1.5 pl-2">Toggle lightning bolt icon</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

