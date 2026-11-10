import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Gift, Loader2, LogOut, Store, User } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreBranding } from "@/hooks/useStoreBranding";
import { CustomerCRM } from "@/components/agent/CustomerCRM";
import { BuySection, StoreSection, PricingSection, MarketingKitSection, LeaderboardSection, TransactionsSection, WithdrawalsSection, SubAgentsSection, SettingsSection, ALL_TABS, MOBILE_TABS, AgentTab } from "./AgentDashboard";

export default function SubAgentDashboard() {
  const [tab, setTab] = useState<AgentTab>("buy");
  const { user, signOut } = useAuth();
  const nav = useNavigate();

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
  const storeName = parentAgent?.store_name || "Data Platform";
  const isSubAgent = !!agentProfile?.parent_agent_id;

  // Sub-agents work under their parent agent's brand.
  useStoreBranding({ brandColor: parentAgent?.store_brand_color });

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
    <DashboardLayout
      title={ALL_TABS.find((t) => t.value === tab)?.label ?? "Dashboard"}
      subtitle={`${agentProfile.store_name} · ${storeName}`}
      tools="notifications"
      brand={<span className="text-sm font-bold text-foreground">{storeName}</span>}
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
      sidebarItems={[
        ...ALL_TABS.map((t) => ({
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
            {tab === "buy"          && <BuySection agentProfile={agentProfile} />}
            {tab === "store"        && <StoreSection agentProfile={agentProfile} userId={user?.id} />}
            {tab === "pricing"      && <PricingSection agentProfile={agentProfile} userId={user?.id} />}
            {tab === "marketing"    && <MarketingKitSection agentProfile={agentProfile} />}
            {tab === "leaderboard"  && <LeaderboardSection agentProfile={agentProfile} />}
            {tab === "transactions" && <TransactionsSection agentId={agentProfile.id} />}
            {tab === "customers"    && <CustomerCRM />}
            {tab === "withdrawals"  && <WithdrawalsSection userId={user?.id!} />}
            {tab === "sub_agents"   && <SubAgentsSection agentProfile={agentProfile} />}
            {tab === "settings"     && <SettingsSection agentProfile={agentProfile} />}
      </div>
    </DashboardLayout>
  );
}
