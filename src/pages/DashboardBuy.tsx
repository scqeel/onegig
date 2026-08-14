import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Briefcase, Home, Package, Signal, User as UserIcon, Zap, Smartphone, Tv } from "lucide-react";
import { BuyDataFlow } from "@/components/buy/BuyDataFlow";
import { BuyAirtimeFlow } from "@/components/buy/BuyAirtimeFlow";
import { PayBillsFlow } from "@/components/buy/PayBillsFlow";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export default function DashboardBuyPage() {
  const { isAgent } = useAuth();
  const loc = useLocation();
  const [activeTab, setActiveTab] = useState<"data" | "airtime" | "bill" | string>("data");

  const sidebarItems = [
    { label: "Overview", to: "/dashboard", icon: <Home className="h-4 w-4" />, active: loc.pathname === "/dashboard" },
    { label: "Buy Data", to: "/dashboard/buy", icon: <Signal className="h-4 w-4" />, active: loc.pathname === "/dashboard/buy" },
    { label: "Track Orders", to: "/dashboard/track", icon: <Package className="h-4 w-4" />, active: loc.pathname === "/dashboard/track" },
    { label: isAgent ? "My Store" : "Become Agent", to: isAgent ? "/agent" : "/dashboard/agent", icon: <Briefcase className="h-4 w-4" />, active: loc.pathname === "/dashboard/agent" || loc.pathname === "/agent" },
    { label: "Profile", to: "/dashboard/profile", icon: <UserIcon className="h-4 w-4" />, active: loc.pathname === "/dashboard/profile" },
  ];

  const getLayoutDetails = () => {
    switch (activeTab) {
      case "airtime":
        return {
          title: "Buy Airtime",
          subtitle: "Top up airtime for any network instantly using wallet balance or direct MoMo.",
          cardTitle: "Buy Airtime",
          cardSubtitle: "Select network, enter details, and pay."
        };
      case "bill":
        return {
          title: "Pay Bills",
          subtitle: "Instantly validate and pay utility bills like DSTV, GOTV, StarTimes & ECG Prepaid.",
          cardTitle: "Pay Utility Bills",
          cardSubtitle: "Enter IUC or meter number to lookup details and pay."
        };
      default:
        return {
          title: "Buy Mobile Data",
          subtitle: "Select a network and bundle, then complete your order.",
          cardTitle: "Buy Mobile Data",
          cardSubtitle: "Pick a network, choose a bundle, and pay. Done in under 60 seconds."
        };
    }
  };

  const details = getLayoutDetails();

  return (
    <DashboardLayout
      title={details.title}
      subtitle={details.subtitle}
      badge="Purchase"
      sidebarItems={sidebarItems}
    >
      <div className="overflow-hidden rounded-[1.75rem] border border-border bg-card">
        {/* Dynamic Card Header */}
        <div className="border-b border-border bg-secondary/40 px-6 py-5 md:px-8">
          <h2 className="text-lg font-bold text-foreground transition-all duration-300">{details.cardTitle}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground transition-all duration-300">{details.cardSubtitle}</p>
        </div>

        {/* Tab Switcher Headers */}
        <div className="border-b border-border bg-secondary/20 p-2 flex gap-1">
          {[
            { id: "data", label: "Buy Data", icon: Zap },
            { id: "airtime", label: "Buy Airtime", icon: Smartphone },
            { id: "bill", label: "Pay Bills", icon: Tv }
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  "flex-1 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-xs md:text-sm transition-colors duration-150",
                  activeTab === t.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Tab Content */}
        <div className="p-5 md:p-8">
          {activeTab === "data" && <BuyDataFlow />}
          {activeTab === "airtime" && <BuyAirtimeFlow />}
          {activeTab === "bill" && <PayBillsFlow />}
        </div>
      </div>
    </DashboardLayout>
  );
}
