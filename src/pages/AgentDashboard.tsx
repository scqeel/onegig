import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BuyDataFlow } from "@/components/buy/BuyDataFlow";
import { CustomerCRM } from "@/components/agent/CustomerCRM";
import { WalletManager } from "@/components/agent/WalletManager";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatGHS, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { useTheme } from "next-themes";
import { subscribeToPushNotifications } from "@/lib/push";

export type AgentTab = "buy" | "store" | "leaderboard" | "transactions" | "customers" | "withdrawals" | "sub_agents" | "settings";

export const ALL_TABS: { label: string; value: AgentTab; icon: React.ReactNode }[] = [
  { label: "Buy Data",     value: "buy",          icon: <Signal className="h-4 w-4" /> },
  { label: "My Store",     value: "store",         icon: <Store className="h-4 w-4" /> },
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
  const { theme, setTheme } = useTheme();

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
            {tab === "buy"          && <BuySection />}
            {tab === "store"        && <StoreSection agentProfile={agentProfile} userId={user?.id} />}
            {tab === "leaderboard"  && <LeaderboardSection agentProfile={agentProfile} />}
            {tab === "transactions" && <TransactionsSection agentId={agentProfile.id} />}
            {tab === "customers"    && <CustomerCRM />}
            {tab === "withdrawals"  && <WithdrawalsSection userId={user?.id!} />}
            {tab === "sub_agents"   && <SubAgentsSection agentProfile={agentProfile} />}
            {tab === "settings"     && <SettingsSection agentProfile={agentProfile} />}
          </main>
        </div>
      </div>

      {/* ── Mobile bottom bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/60 bg-white/95 backdrop-blur-sm dark:bg-card/95 lg:hidden">
        <div className="flex">
          {TABS.map((t) => {
            const active = tab === t.value;
            return (
              <button
                type="button"
                key={t.value}
                onClick={() => setTab(t.value)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <span className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-lg transition-all [&_svg]:h-4 [&_svg]:w-4",
                  active ? "bg-primary/10" : ""
                )}>
                  {t.icon}
                </span>
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

// ── Buy ──────────────────────────────────────────────────────────────────────

export function BuySection() {
  const { data: bundles } = useQuery({
    queryKey: ["agent-buy-admin-prices"],
    queryFn: async () => {
      const { data } = await supabase.from("bundles").select("id, base_price").eq("active", true);
      return data ?? [];
    },
  });

  const adminPrices: Record<string, number> = {};
  (bundles ?? []).forEach((b: any) => { adminPrices[b.id] = Number(b.base_price); });

  return (
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
      <div className="border-b border-border/60 bg-[#080c1a] px-5 py-4 md:px-6">
        <h2 className="text-base font-bold text-white">Buy Data</h2>
        <p className="mt-0.5 text-xs text-white/50">You purchase at admin-set base prices.</p>
      </div>
      <div className="p-5 md:p-6">
        <BuyDataFlow priceOverrides={adminPrices} />
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

  return (
    <div className="space-y-4">
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
        .select("id, recipient_phone, status, sell_price, agent_profit, created_at, bundle:bundles(size_label, size_mb), network:networks(name, logo_emoji)")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false })
        .limit(200);
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
          { label: "Total Profit", value: formatGHS(totalProfit), icon: TrendingUp, iconBg: "bg-green-500/10", iconCl: "text-green-500",  valCl: "text-green-700 dark:text-green-400" },
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

        <div className="flex shrink-0 gap-1 rounded-xl border border-border/50 bg-secondary/40 p-1">
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
                      <p className="text-sm font-black tabular-nums text-foreground">{formatGHS(o.sell_price)}</p>
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
        supabase.from("withdrawals").select("id, amount, momo_number, momo_name, momo_network, status, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
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
            <TrendingUp className="h-3.5 w-3.5" /> Total Revenue
          </div>
          <p className="mt-3 text-4xl font-bold text-foreground">{isLoading ? "…" : formatGHS(walletData?.totalRevenue ?? 0)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Lifetime earnings</p>
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
                  <div key={sa.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-secondary/20">
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
                    {/* In future, link to a dashboard to impersonate/manage this sub-agent's prices */}
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Joined {timeAgo(sa.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
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
  });
  const [widgetEnabled, setWidgetEnabled] = useState(() => {
    return localStorage.getItem("og_whatsapp_widget") !== "false";
  });
  const [pushEnabled, setPushEnabled] = useState(Notification.permission === "granted");
  const [saving, setSaving] = useState(false);

  const f = (key: keyof typeof form, val: string) => setForm((p) => ({ ...p, [key]: val }));

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
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Logo URL</label>
            <Input className="h-11 rounded-xl" value={form.store_logo_url} onChange={(e) => f("store_logo_url", e.target.value)} placeholder="https://example.com/logo.png" />
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
            <div className="mt-4 flex items-center justify-between text-[10px] font-semibold text-muted-foreground border-t border-border/40 pt-3">
              <span>Ending: 2026-06-30</span>
              <span className="text-green-500 font-bold uppercase tracking-wider">GH₵500 Reward</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
