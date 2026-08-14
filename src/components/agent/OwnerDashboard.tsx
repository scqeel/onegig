import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { WalletManager } from "./WalletManager";
import { CustomerCRM } from "./CustomerCRM";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { formatGHS } from "@/lib/format";
import { 
  LayoutDashboard, 
  Settings, 
  Users, 
  Wallet, 
  Layers, 
  ExternalLink,
  MessageCircle,
  Phone,
  Paintbrush,
  Store,
  ChevronRight,
  TrendingUp,
  CreditCard
} from "lucide-react";

interface Props {
  agent: any;
  onPreviewStore: () => void;
  slug: string;
}

type DashboardTab = "overview" | "wallet" | "crm" | "bulk" | "settings";

export function OwnerDashboard({ agent, onPreviewStore, slug }: Props) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");

  // Settings State
  const [storeName, setStoreName] = useState(agent?.store_name || "");
  const [tagline, setTagline] = useState(agent?.store_tagline || "");
  const [whatsapp, setWhatsapp] = useState(agent?.support_whatsapp || "");
  const [widgetEnabled, setWidgetEnabled] = useState(() => {
    return localStorage.getItem("og_whatsapp_widget") !== "false";
  });
  const [aiEnabled, setAiEnabled] = useState(agent?.enable_ai_assistant !== false);
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(agent?.enable_loyalty_rewards !== false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Fetch quick stats
  const { data: stats } = useQuery({
    queryKey: ["agent-stats", agent?.id],
    enabled: !!agent?.id,
    queryFn: async () => {
      // Get today's orders
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { data: orders } = await supabase
        .from("orders")
        .select("sell_price, agent_profit, status")
        .eq("agent_id", agent.id)
        .gte("created_at", startOfDay.toISOString());

      const todaySales = (orders || []).filter(o => o.status === 'delivered').reduce((sum, o) => sum + Number(o.sell_price), 0);
      const todayProfit = (orders || []).filter(o => o.status === 'delivered').reduce((sum, o) => sum + Number(o.agent_profit), 0);

      const { data: balData } = await supabase.rpc("get_wallet_balance", { _user_id: profile?.id });
      
      return { 
        ordersToday: orders?.length || 0, 
        salesToday: todaySales,
        profitToday: todayProfit,
        walletBalance: Number(balData || 0)
      };
    }
  });

  const saveSettings = async () => {
    setSavingSettings(true);
    localStorage.setItem("og_whatsapp_widget", String(widgetEnabled));
    
    try {
      const { error } = await supabase
        .from("agent_profiles")
        .update({
          store_name: storeName,
          store_tagline: tagline,
          support_whatsapp: whatsapp,
          enable_ai_assistant: aiEnabled,
          enable_loyalty_rewards: loyaltyEnabled
        })
        .eq("id", agent.id);

      if (error) {
        if (error.message.includes("enable_ai_assistant")) {
          throw new Error("Database columns missing. Please run the migration: npx supabase db push");
        }
        throw error;
      }
      toast({ title: "Settings Saved Successfully!" });
    } catch (e: any) {
      toast({ title: "Failed to save settings", description: e.message, variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  const navItems = [
    { id: "overview", label: "Dashboard", icon: LayoutDashboard },
    { id: "wallet", label: "Wallet & Topup", icon: Wallet },
    { id: "crm", label: "Customers (CRM)", icon: Users },
    { id: "bulk", label: "Bulk Orders", icon: Layers },
    { id: "settings", label: "Store Settings", icon: Settings },
  ];

  return (
    <div className="min-h-dvh bg-background flex font-sans text-foreground">
      
      {/* Sidebar */}
      <div className="w-64 bg-card border-r border-border/60 hidden md:flex flex-col">
        <div className="h-20 flex items-center px-6 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-bold shadow-soft">
              OG
            </div>
            <div>
              <h2 className="font-bold text-sm tracking-tight leading-tight">Agent<br/>Workspace</h2>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          <p className="px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Main Menu</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as DashboardTab)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all font-semibold text-sm ${
                  active 
                  ? "bg-primary/10 text-primary font-bold" 
                  : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                {item.label}
              </button>
            )
          })}
        </div>

        <div className="p-4 border-t border-border/60">
          <Button 
            onClick={onPreviewStore}
            variant="outline" 
            className="w-full justify-start h-12 rounded-xl border-border text-foreground font-bold"
          >
            <ExternalLink className="mr-2 h-4 w-4" /> View Public Store
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-dvh overflow-hidden relative">
        
        {/* Mobile Header */}
        <div className="md:hidden h-16 bg-card border-b border-border/60 flex items-center justify-between px-4">
          <div className="font-bold text-lg">Dashboard</div>
          <Button onClick={onPreviewStore} size="sm" variant="outline" className="rounded-lg h-9 text-xs font-bold">
            <Store className="mr-1.5 h-3.5 w-3.5" /> View Store
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Header Title */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-foreground capitalize">
                {activeTab.replace("-", " ")}
              </h1>
              <p className="text-sm text-muted-foreground mt-1 font-medium">
                Manage your agent business and monitor performance.
              </p>
            </div>

            {/* TAB CONTENT: Overview */}
            {activeTab === "overview" && (
              <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Stat Card 1 */}
                  <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-soft">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Wallet Balance</p>
                        <h3 className="text-2xl font-bold text-foreground mt-1">
                          {formatGHS(stats?.walletBalance || 0)}
                        </h3>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600">
                        <Wallet className="h-5 w-5" />
                      </div>
                    </div>
                  </div>

                  {/* Stat Card 2 */}
                  <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-soft">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Today's Sales</p>
                        <h3 className="text-2xl font-bold text-foreground mt-1">
                          {formatGHS(stats?.salesToday || 0)}
                        </h3>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                        <TrendingUp className="h-5 w-5" />
                      </div>
                    </div>
                  </div>

                  {/* Stat Card 3 */}
                  <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-soft">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Today's Orders</p>
                        <h3 className="text-2xl font-bold text-foreground mt-1">
                          {stats?.ordersToday || 0}
                        </h3>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600">
                        <CreditCard className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-soft min-h-[300px] flex items-center justify-center text-center">
                  <div>
                    <div className="mx-auto h-16 w-16 bg-secondary rounded-full flex items-center justify-center mb-4">
                      <LayoutDashboard className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="font-bold text-foreground">Advanced Analytics Coming Soon</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">Detailed charts and revenue metrics will be available in the next platform update.</p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Wallet */}
            {activeTab === "wallet" && (
              <WalletManager />
            )}

            {/* TAB CONTENT: CRM */}
            {activeTab === "crm" && (
              <CustomerCRM />
            )}

            {/* TAB CONTENT: Bulk Orders */}
            {activeTab === "bulk" && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-soft animate-in fade-in zoom-in-95 duration-300">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Layers className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Bulk Processing</h2>
                    <p className="text-sm text-muted-foreground font-medium">Process hundreds of orders instantly.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-foreground mb-2 block">Upload CSV or Paste Numbers</label>
                    <textarea
                      rows={6}
                      className="w-full border border-border rounded-xl p-4 text-sm font-mono bg-background focus:ring-2 focus:ring-primary/20"
                      placeholder="0241234567, 5GB&#10;0501234567, 10GB"
                    />
                  </div>
                  <Button className="h-12 px-8 rounded-xl">
                    Validate & Process Bulk Order
                  </Button>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Settings */}
            {activeTab === "settings" && (
              <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">

                {/* Store Profile Settings */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-soft">
                  <div className="px-6 py-5 border-b border-border bg-secondary/40">
                    <h2 className="font-bold text-foreground flex items-center gap-2">
                      <Store className="h-5 w-5 text-muted-foreground" /> Store Profile
                    </h2>
                  </div>
                  <div className="p-6 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-foreground mb-1.5">Store Name</label>
                        <Input value={storeName} onChange={e => setStoreName(e.target.value)} className="h-12 rounded-xl" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-foreground mb-1.5">Store Slug (URL)</label>
                        <Input value={slug} disabled className="h-12 rounded-xl bg-secondary text-muted-foreground cursor-not-allowed" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-1.5">Tagline / Welcome Message</label>
                      <Input value={tagline} onChange={e => setTagline(e.target.value)} className="h-12 rounded-xl" />
                    </div>
                  </div>
                </div>

                {/* Support & Widget Settings */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-soft">
                  <div className="px-6 py-5 border-b border-border bg-secondary/40">
                    <h2 className="font-bold text-foreground flex items-center gap-2">
                      <MessageCircle className="h-5 w-5 text-emerald-500" /> Support & Widgets
                    </h2>
                  </div>
                  <div className="p-6 space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-1.5">Support WhatsApp Number (Include Country Code)</label>
                      <Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="233241234567" className="h-12 rounded-xl" />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-secondary/40 border border-border rounded-xl">
                      <div>
                        <h4 className="font-semibold text-foreground">Draggable WhatsApp Button</h4>
                        <p className="text-sm text-muted-foreground mt-0.5">Show a floating chat button on your public storefront.</p>
                      </div>
                      <button
                        onClick={() => setWidgetEnabled(!widgetEnabled)}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${widgetEnabled ? 'bg-emerald-500' : 'bg-secondary'}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${widgetEnabled ? 'translate-x-8' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-secondary/40 border border-border rounded-xl">
                      <div>
                        <h4 className="font-semibold text-foreground">AI Assistant Widget</h4>
                        <p className="text-sm text-muted-foreground mt-0.5">Enable the draggable AI chatbot for your customers.</p>
                      </div>
                      <button
                        onClick={() => setAiEnabled(!aiEnabled)}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${aiEnabled ? 'bg-primary' : 'bg-secondary'}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${aiEnabled ? 'translate-x-8' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-secondary/40 border border-border rounded-xl">
                      <div>
                        <h4 className="font-semibold text-foreground">Loyalty Rewards Hub</h4>
                        <p className="text-sm text-muted-foreground mt-0.5">Show the draggable trophy button for points and rewards.</p>
                      </div>
                      <button
                        onClick={() => setLoyaltyEnabled(!loyaltyEnabled)}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${loyaltyEnabled ? 'bg-amber-500' : 'bg-secondary'}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${loyaltyEnabled ? 'translate-x-8' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={saveSettings}
                    disabled={savingSettings}
                    className="h-12 px-8 rounded-xl"
                  >
                    {savingSettings ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden flex items-center justify-between bg-card border-t border-border px-2 py-3 pb-safe">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as DashboardTab)}
                className={`flex flex-col items-center justify-center w-full p-2 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5 mb-1" />
                <span className="text-[9px] font-semibold tracking-wider uppercase">{item.label.split(' ')[0]}</span>
              </button>
            )
          })}
        </div>

      </div>
    </div>
  );
}
