import { useState } from "react";
import {
  Activity, BarChart3, Cog, DollarSign, Gift, GitBranch, Globe2,
  Megaphone, RefreshCw, Settings, ShoppingCart, Terminal, Users, 
  Wallet, Zap
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminHeartbeatRibbon } from "@/components/admin/AdminHeartbeatRibbon";
import { ProviderBalancePill } from "@/components/admin/ProviderBalancePill";

// Core Tabs
import { AdminOverviewTab } from "@/components/admin/tabs/AdminOverviewTab";
import { AdminAnalyticsTab } from "@/components/admin/tabs/AdminAnalyticsTab";
import { AdminOrdersTab } from "@/components/admin/tabs/AdminOrdersTab";
import { AdminSubscriptionsTab } from "@/components/admin/tabs/AdminSubscriptionsTab";
import { AdminPricingTab } from "@/components/admin/tabs/AdminPricingTab";
import { AdminAgentTreeTab } from "@/components/admin/tabs/AdminAgentTreeTab";
import { AdminUsersTab } from "@/components/admin/tabs/AdminUsersTab";
import { AdminIntegrationsTab } from "@/components/admin/tabs/AdminIntegrationsTab";
import { AdminWithdrawalsTab } from "@/components/admin/tabs/AdminWithdrawalsTab";
import { AdminPaymentsTab } from "@/components/admin/tabs/AdminPaymentsTab";
import { AdminBroadcastTab } from "@/components/admin/tabs/AdminBroadcastTab";
import { AdminMarketingTab } from "@/components/admin/tabs/AdminMarketingTab";
import { AdminCouponsTab } from "@/components/admin/tabs/AdminCouponsTab";
import { AdminAuditLogsTab } from "@/components/admin/tabs/AdminAuditLogsTab";
import { AdminSettingsTab } from "@/components/admin/tabs/AdminSettingsTab";
import { cn } from "@/lib/utils";

type Tab = 
  | "overview" | "analytics" 
  | "orders" | "subscriptions" | "pricing" 
  | "agents" | "users" 
  | "integrations" | "withdrawals" | "payments" 
  | "broadcast" | "marketing" | "coupons" 
  | "audit" | "settings";

interface NavHub {
  hub: string;
  items: { label: string; value: Tab; icon: React.ReactNode }[];
}

const NAV_HUBS: NavHub[] = [
  {
    hub: "Command Center",
    items: [
      { label: "Overview",   value: "overview",  icon: <Activity className="h-4 w-4" /> },
      { label: "Profit & Telemetry", value: "analytics", icon: <BarChart3 className="h-4 w-4" /> },
    ],
  },
  {
    hub: "Operations",
    items: [
      { label: "Orders & Batch Sync", value: "orders",        icon: <ShoppingCart className="h-4 w-4" /> },
      { label: "Momo Subscriptions",  value: "subscriptions", icon: <RefreshCw className="h-4 w-4" /> },
      { label: "Carrier Bundles",     value: "pricing",       icon: <Cog className="h-4 w-4" /> },
    ],
  },
  {
    hub: "Agent Ecosystem",
    items: [
      { label: "Agent Downline Tree", value: "agents", icon: <GitBranch className="h-4 w-4" /> },
      { label: "User Directory",     value: "users",  icon: <Users className="h-4 w-4" /> },
    ],
  },
  {
    hub: "Finance & Liquidity",
    items: [
      { label: "Provider Switchboard", value: "integrations", icon: <Globe2 className="h-4 w-4" /> },
      { label: "Agent MoMo Payouts",   value: "withdrawals",  icon: <Wallet className="h-4 w-4" /> },
      { label: "Payment Gateways",     value: "payments",     icon: <DollarSign className="h-4 w-4" /> },
    ],
  },
  {
    hub: "Growth & Broadcast",
    items: [
      { label: "Broadcast Studio", value: "broadcast", icon: <Megaphone className="h-4 w-4" /> },
      { label: "Store Campaigns",  value: "marketing", icon: <Zap className="h-4 w-4" /> },
      { label: "Promo Coupons",    value: "coupons",   icon: <Gift className="h-4 w-4" /> },
    ],
  },
  {
    hub: "Infrastructure",
    items: [
      { label: "Webhook Audit Stream", value: "audit",    icon: <Terminal className="h-4 w-4" /> },
      { label: "Platform Settings",    value: "settings", icon: <Settings className="h-4 w-4" /> },
    ],
  },
];

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");

  // Flattened sidebar items for standard DashboardLayout sidebar
  const allSidebarItems = NAV_HUBS.flatMap((h) => h.items);

  // Find active hub name
  const currentHub = NAV_HUBS.find((h) => h.items.some((i) => i.value === tab)) || NAV_HUBS[0];

  return (
    <DashboardLayout
      title="Admin Executive Console"
      subtitle="Complete command center over orders, provider routing, agent downlines, and financial margins."
      badge="Tier-1 Root Admin"
      sidebarItems={allSidebarItems.map((item) => ({
        label: item.label,
        icon: item.icon,
        active: tab === item.value,
        onClick: () => setTab(item.value),
      }))}
      topActions={
        <div className="flex flex-wrap items-center gap-3">
          <ProviderBalancePill />
          <a
            href="/dashboard"
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-95 shadow-sm"
          >
            <RefreshCw className="h-3 w-3" />
            Merchant Portal
          </a>
        </div>
      }
    >
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Real-time System Heartbeat Ribbon */}
        <AdminHeartbeatRibbon onSelectTab={(newTab) => setTab(newTab as Tab)} />

        {/* Quick Hub Filter Bar */}
        <div className="overflow-x-auto pb-1">
          <div className="flex items-center gap-2 min-w-max border-b border-border/40 pb-3">
            {NAV_HUBS.map((hubGroup) => {
              const isGroupActive = hubGroup.items.some((i) => i.value === tab);

              return (
                <div key={hubGroup.hub} className="flex items-center gap-1 rounded-xl bg-secondary/30 p-1 border border-border/40">
                  <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {hubGroup.hub}
                  </span>
                  <div className="flex items-center gap-1">
                    {hubGroup.items.map((subItem) => {
                      const isActive = tab === subItem.value;
                      return (
                        <button
                          key={subItem.value}
                          type="button"
                          onClick={() => setTab(subItem.value)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all whitespace-nowrap",
                            isActive
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                          )}
                        >
                          {subItem.icon}
                          <span>{subItem.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Tab View */}
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {tab === "overview"      && <AdminOverviewTab />}
          {tab === "analytics"     && <AdminAnalyticsTab />}
          {tab === "orders"        && <AdminOrdersTab />}
          {tab === "subscriptions" && <AdminSubscriptionsTab />}
          {tab === "pricing"       && <AdminPricingTab />}
          {tab === "agents"        && <AdminAgentTreeTab />}
          {tab === "users"         && <AdminUsersTab />}
          {tab === "integrations"  && <AdminIntegrationsTab />}
          {tab === "withdrawals"   && <AdminWithdrawalsTab />}
          {tab === "payments"      && <AdminPaymentsTab />}
          {tab === "broadcast"     && <AdminBroadcastTab />}
          {tab === "marketing"     && <AdminMarketingTab />}
          {tab === "coupons"       && <AdminCouponsTab />}
          {tab === "audit"         && <AdminAuditLogsTab />}
          {tab === "settings"      && <AdminSettingsTab />}
        </div>
      </div>
    </DashboardLayout>
  );
}
