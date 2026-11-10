import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Gift, Globe, Layers, Loader2, LogOut, Megaphone,
  Shield, ShoppingCart, Signal, Store, Tag, Trophy, User, Users, Wallet, X, Zap
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Tab Sub-Components
import { AgentPosTab } from "@/components/agent/tabs/AgentPosTab";
import { AgentStoreTab } from "@/components/agent/tabs/AgentStoreTab";
import { AgentPricingTab } from "@/components/agent/tabs/AgentPricingTab";
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
  | "pricing"
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
  { value: "pricing",      label: "Store Pricing & Profits", icon: <Tag className="h-4 w-4" /> },
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
export const PricingSection = AgentPricingTab;
export const MarketingKitSection = AgentMarketingTab;
export const LeaderboardSection = AgentLeaderboardTab;
export const TransactionsSection = AgentTransactionsTab;
export const WithdrawalsSection = AgentWalletTab;
export const SubAgentsSection = AgentSubAgentsTab;
export const SettingsSection = AgentSettingsTab;

export const MOBILE_TABS: Partial<Record<AgentTab, { shortLabel: string; mobilePriority: number }>> = {
  buy: { shortLabel: "Sell", mobilePriority: 1 },
  store: { shortLabel: "My Store", mobilePriority: 2 },
  withdrawals: { shortLabel: "Wallet", mobilePriority: 3 },
  transactions: { shortLabel: "Sales", mobilePriority: 4 },
};

export default function AgentDashboard() {
  const { user, signOut, isAdmin } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<AgentTab>("buy");
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
    <DashboardLayout
      title={TABS.find((t) => t.value === tab)?.label ?? "Dashboard"}
      subtitle={agentProfile.store_name}
      tools="notifications"
      brand={<Logo size="sm" />}
      sidebarHeader={
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">{agentProfile.store_name}</p>
              <p className="truncate text-[10px] text-muted-foreground">/store/{agentProfile.store_slug}</p>
            </div>
          </div>
          <p className="mt-2.5 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active Agent
          </p>
        </div>
      }
      topActions={
        isAdmin ? (
          <Button asChild variant="outline" className="h-10 rounded-xl text-xs font-semibold">
            <Link to="/admin"><Shield className="mr-1.5 h-3.5 w-3.5" /> Admin</Link>
          </Button>
        ) : undefined
      }
      sidebarItems={[
        ...TABS.map((t) => ({
          label: t.label,
          icon: t.icon,
          active: tab === t.value,
          onClick: () => setTab(t.value),
          ...MOBILE_TABS[t.value],
        })),
        { label: "Refer & Earn", to: "/dashboard/referrals", icon: <Gift className="h-4 w-4" /> },
        { label: "My Profile", to: "/dashboard/profile", icon: <User className="h-4 w-4" /> },
        { label: "Back to site", to: "/", icon: <ArrowLeft className="h-4 w-4" /> },
        { label: "Sign out", onClick: signOut, icon: <LogOut className="h-4 w-4" /> },
      ]}
    >
      <div className="animate-in fade-in duration-300">
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
            {tab === "pricing"      && <AgentPricingTab agentProfile={agentProfile} userId={user?.id} />}
            {tab === "marketing"    && <AgentMarketingTab agentProfile={agentProfile} />}
            {tab === "leaderboard"  && <AgentLeaderboardTab agentProfile={agentProfile} />}
            {tab === "transactions" && <AgentTransactionsTab agentId={agentProfile.id} />}
            {tab === "customers"    && <CustomerCRM />}
            {tab === "withdrawals"  && <AgentWalletTab userId={user?.id!} />}
            {tab === "sub_agents"   && <AgentSubAgentsTab agentProfile={agentProfile} />}
            {tab === "settings"     && <AgentSettingsTab agentProfile={agentProfile} />}
      </div>
    </DashboardLayout>
  );
}
