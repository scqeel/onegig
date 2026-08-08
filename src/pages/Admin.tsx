import { useState } from "react";
import {
  Activity, Cog, DollarSign, Gift, Globe2,
  Megaphone, RefreshCw, Settings, ShoppingCart, Users, Wallet,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminOverviewTab } from "@/components/admin/tabs/AdminOverviewTab";
import { AdminUsersTab } from "@/components/admin/tabs/AdminUsersTab";
import { AdminOrdersTab } from "@/components/admin/tabs/AdminOrdersTab";
import { AdminPaymentsTab } from "@/components/admin/tabs/AdminPaymentsTab";
import { AdminSubscriptionsTab } from "@/components/admin/tabs/AdminSubscriptionsTab";
import { AdminWithdrawalsTab } from "@/components/admin/tabs/AdminWithdrawalsTab";
import { AdminPricingTab } from "@/components/admin/tabs/AdminPricingTab";
import { AdminIntegrationsTab } from "@/components/admin/tabs/AdminIntegrationsTab";
import { AdminSettingsTab } from "@/components/admin/tabs/AdminSettingsTab";
import { AdminMarketingTab } from "@/components/admin/tabs/AdminMarketingTab";
import { AdminCouponsTab } from "@/components/admin/tabs/AdminCouponsTab";

type Tab = "overview" | "users" | "orders" | "payments" | "withdrawals" | "pricing" | "integrations" | "settings" | "marketing" | "coupons" | "subscriptions";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");

  const sidebarItems = [
    { label: "Overview",           value: "overview",      icon: <Activity className="h-4 w-4" /> },
    { label: "Users",              value: "users",         icon: <Users className="h-4 w-4" /> },
    { label: "Orders",             value: "orders",        icon: <ShoppingCart className="h-4 w-4" /> },
    { label: "Payments",           value: "payments",      icon: <DollarSign className="h-4 w-4" /> },
    { label: "Momo Subscriptions", value: "subscriptions", icon: <RefreshCw className="h-4 w-4" /> },
    { label: "Withdrawals",        value: "withdrawals",   icon: <Wallet className="h-4 w-4" /> },
    { label: "Pricing",            value: "pricing",       icon: <Cog className="h-4 w-4" /> },
    { label: "Marketing",          value: "marketing",     icon: <Megaphone className="h-4 w-4" /> },
    { label: "Promo Coupons",       value: "coupons",       icon: <Gift className="h-4 w-4" /> },
    { label: "Integrations",       value: "integrations",  icon: <Globe2 className="h-4 w-4" /> },
    { label: "Site Settings",      value: "settings",      icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <DashboardLayout
      title="Admin Dashboard"
      subtitle="Complete control over users, orders, pricing, and system configurations."
      badge="Admin Console"
      sidebarItems={sidebarItems.map((item) => ({
        label: item.label,
        icon: item.icon,
        active: tab === (item.value as Tab),
        onClick: () => setTab(item.value as Tab),
      }))}
      topActions={
        <a
          href="/dashboard"
          className="flex items-center gap-2 rounded-xl border border-border/40 bg-card/50 px-4 py-2 text-xs font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
        >
          <RefreshCw className="h-3 w-3" />
          Back to Dashboard
        </a>
      }
    >
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {tab === "overview"      && <AdminOverviewTab />}
        {tab === "users"         && <AdminUsersTab />}
        {tab === "orders"        && <AdminOrdersTab />}
        {tab === "payments"      && <AdminPaymentsTab />}
        {tab === "subscriptions" && <AdminSubscriptionsTab />}
        {tab === "withdrawals"   && <AdminWithdrawalsTab />}
        {tab === "pricing"       && <AdminPricingTab />}
        {tab === "marketing"     && <AdminMarketingTab />}
        {tab === "coupons"       && <AdminCouponsTab />}
        {tab === "integrations"  && <AdminIntegrationsTab />}
        {tab === "settings"      && <AdminSettingsTab />}
      </div>
    </DashboardLayout>
  );
}
