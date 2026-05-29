import { useLocation } from "react-router-dom";
import { Briefcase, Home, Package, Signal, User as UserIcon } from "lucide-react";
import { TrackOrder } from "@/components/buy/TrackOrder";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardTrackPage() {
  const { isAgent } = useAuth();
  const loc = useLocation();

  const sidebarItems = [
    { label: "Overview", to: "/dashboard", icon: <Home className="h-4 w-4" />, active: loc.pathname === "/dashboard" },
    { label: "Buy Data", to: "/dashboard/buy", icon: <Signal className="h-4 w-4" />, active: loc.pathname === "/dashboard/buy" },
    { label: "Track Orders", to: "/dashboard/track", icon: <Package className="h-4 w-4" />, active: loc.pathname === "/dashboard/track" },
    { label: isAgent ? "My Store" : "Become Agent", to: isAgent ? "/agent" : "/dashboard/agent", icon: <Briefcase className="h-4 w-4" />, active: loc.pathname === "/dashboard/agent" || loc.pathname === "/agent" },
    { label: "Profile", to: "/dashboard/profile", icon: <UserIcon className="h-4 w-4" />, active: loc.pathname === "/dashboard/profile" },
  ];

  return (
    <DashboardLayout
      title="Track Orders"
      subtitle="Search and monitor your order progress in real time."
      badge="Tracking"
      sidebarItems={sidebarItems}
    >
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
        <div className="border-b border-border/60 bg-[#080c1a] px-6 py-5 md:px-8">
          <h2 className="text-lg font-bold text-white">Track Orders</h2>
          <p className="mt-0.5 text-sm text-white/50">Enter the recipient phone number to check your order status.</p>
        </div>
        <div className="p-5 md:p-8">
          <TrackOrder />
        </div>
      </div>
    </DashboardLayout>
  );
}
