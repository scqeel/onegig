import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Check, 
  CheckCircle2, 
  Cog, 
  CreditCard, 
  FileText, 
  Loader2, 
  Package, 
  Percent, 
  Plus, 
  Save, 
  Search, 
  Settings, 
  Smartphone, 
  Trash2, 
  Zap 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatGHS } from "@/lib/format";
import { cn } from "@/lib/utils";

function LoadingCard({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card/50 p-8 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      {text}
    </div>
  );
}

export function AdminPricingTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  
  // Data bundle creation/editing state
  const [form, setForm] = useState({ 
    network_id: "", 
    size_label: "", 
    size_gb: "", 
    user_price: "", 
    base_price: "" 
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeNetworkFilter, setActiveNetworkFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Inline bundle price edit state
  const [inlinePrices, setInlinePrices] = useState<Record<string, { user_price: string; base_price: string }>>({});
  const [savingBundleId, setSavingBundleId] = useState<string | null>(null);

  // Settings states
  const [activationFee, setActivationFee] = useState("50");
  const [savingFee, setSavingFee] = useState(false);

  // Result Checker pricing state
  const [resultCheckerPrices, setResultCheckerPrices] = useState({
    wassce_user: "25.00",
    wassce_agent: "20.00",
    bece_user: "25.00",
    bece_agent: "20.00",
    cssps_user: "15.00",
    cssps_agent: "12.00",
    novdec_user: "30.00",
    novdec_agent: "25.00"
  });
  const [savingChecker, setSavingChecker] = useState(false);

  // Airtime discounts state
  const [airtimeDiscounts, setAirtimeDiscounts] = useState({
    mtn_discount: "2.0",
    telecel_discount: "3.0",
    at_discount: "4.0"
  });
  const [savingAirtime, setSavingAirtime] = useState(false);

  const { data: payload, isLoading } = useQuery({
    queryKey: ["admin-pricing"],
    queryFn: async () => {
      const [
        { data: networks }, 
        { data: bundles }, 
        { data: feeRow },
        { data: checkerRow },
        { data: airtimeRow }
      ] = await Promise.all([
        supabase.from("networks").select("id, name, code, logo_emoji").order("sort_order"),
        supabase.from("bundles").select("*").order("size_mb", { ascending: true }),
        supabase.from("app_settings").select("value").eq("key", "agent_activation_fee").maybeSingle(),
        supabase.from("app_settings").select("value").eq("key", "result_checker_pricing").maybeSingle(),
        supabase.from("app_settings").select("value").eq("key", "airtime_discounts").maybeSingle(),
      ]);

      return { 
        networks: networks ?? [], 
        bundles: bundles ?? [], 
        activationFee: Number(feeRow?.value ?? 50),
        resultCheckerPricing: checkerRow?.value ?? null,
        airtimeDiscounts: airtimeRow?.value ?? null
      };
    },
  });

  useEffect(() => {
    if (payload?.activationFee != null) {
      setActivationFee(String(payload.activationFee));
    }
    if (payload?.resultCheckerPricing && typeof payload.resultCheckerPricing === "object") {
      setResultCheckerPrices(prev => ({ ...prev, ...(payload.resultCheckerPricing as any) }));
    }
    if (payload?.airtimeDiscounts && typeof payload.airtimeDiscounts === "object") {
      setAirtimeDiscounts(prev => ({ ...prev, ...(payload.airtimeDiscounts as any) }));
    }
    if (payload?.bundles) {
      const initialMap: Record<string, { user_price: string; base_price: string }> = {};
      payload.bundles.forEach((b: any) => {
        initialMap[b.id] = {
          user_price: String(b.user_price ?? b.base_price ?? "0"),
          base_price: String(b.base_price ?? "0"),
        };
      });
      setInlinePrices(initialMap);
    }
  }, [payload]);

  const saveBundle = async () => {
    if (!form.network_id || !form.size_label || !form.size_gb || !form.base_price || !form.user_price) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    const row = {
      network_id: form.network_id,
      size_label: form.size_label,
      size_mb: Math.round(Number(form.size_gb) * 1000),
      user_price: Number(form.user_price),
      base_price: Number(form.base_price),
      sort_order: 0,
      active: true,
    };
    if (editingId) {
      const { error } = await supabase.from("bundles").update(row as any).eq("id", editingId);
      if (error) { 
        toast({ title: "Update failed", description: error.message, variant: "destructive" }); 
        return; 
      }
      toast({ title: "Package updated successfully! 🎉" });
    } else {
      const { error } = await supabase.from("bundles").insert(row as any);
      if (error) { 
        toast({ title: "Create failed", description: error.message, variant: "destructive" }); 
        return; 
      }
      toast({ title: "New package created! 🎉" });
    }
    setForm({ network_id: "", size_label: "", size_gb: "", user_price: "", base_price: "" });
    setEditingId(null);
    qc.invalidateQueries({ queryKey: ["admin-pricing"] });
  };

  const handleInlineSave = async (bundleId: string) => {
    const current = inlinePrices[bundleId];
    if (!current) return;
    setSavingBundleId(bundleId);
    try {
      const uPrice = Number(current.user_price);
      const bPrice = Number(current.base_price);
      if (isNaN(uPrice) || isNaN(bPrice) || uPrice <= 0 || bPrice <= 0) {
        throw new Error("Prices must be valid positive numbers");
      }

      const { error } = await supabase
        .from("bundles")
        .update({ user_price: uPrice, base_price: bPrice } as any)
        .eq("id", bundleId);

      if (error) throw error;
      toast({ title: "Prices updated successfully! 💾" });
      qc.invalidateQueries({ queryKey: ["admin-pricing"] });
    } catch (err: any) {
      toast({ title: "Failed to save prices", description: err.message, variant: "destructive" });
    } finally {
      setSavingBundleId(null);
    }
  };

  const toggleBundleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase.from("bundles").update({ active: !currentActive }).eq("id", id);
    if (error) { 
      toast({ title: "Status update failed", description: error.message, variant: "destructive" }); 
      return; 
    }
    toast({ title: currentActive ? "Package deactivated" : "Package activated! ✅" });
    qc.invalidateQueries({ queryKey: ["admin-pricing"] });
  };

  const removeBundle = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate and remove this package?")) return;
    const { error } = await supabase.from("bundles").update({ active: false }).eq("id", id);
    if (error) { 
      toast({ title: "Delete failed", description: error.message, variant: "destructive" }); 
      return; 
    }
    toast({ title: "Package deactivated" });
    qc.invalidateQueries({ queryKey: ["admin-pricing"] });
  };

  const saveActivationFee = async () => {
    setSavingFee(true);
    try {
      const { error } = await supabase.from("app_settings").upsert({ 
        key: "agent_activation_fee", 
        value: Number(activationFee) 
      });
      if (error) throw error;
      toast({ title: "Activation fee updated! 💰" });
      qc.invalidateQueries({ queryKey: ["admin-pricing"] });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSavingFee(false);
    }
  };

  const saveResultCheckerPricing = async () => {
    setSavingChecker(true);
    try {
      const { error } = await supabase.from("app_settings").upsert({ 
        key: "result_checker_pricing", 
        value: resultCheckerPrices 
      });
      if (error) throw error;
      toast({ title: "Result Checker pricing updated! 🎓" });
      qc.invalidateQueries({ queryKey: ["admin-pricing"] });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSavingChecker(false);
    }
  };

  const saveAirtimeDiscounts = async () => {
    setSavingAirtime(true);
    try {
      const { error } = await supabase.from("app_settings").upsert({ 
        key: "airtime_discounts", 
        value: airtimeDiscounts 
      });
      if (error) throw error;
      toast({ title: "Airtime discount settings saved! ⚡" });
      qc.invalidateQueries({ queryKey: ["admin-pricing"] });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSavingAirtime(false);
    }
  };

  if (isLoading) return <LoadingCard text="Syncing pricing configurations…" />;

  const networks = payload?.networks ?? [];
  const bundles = payload?.bundles ?? [];

  const filteredBundles = bundles.filter((b: any) => {
    if (activeNetworkFilter !== "all" && b.network_id !== activeNetworkFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const label = (b.size_label || "").toLowerCase();
      const net = (networks.find((n: any) => n.id === b.network_id)?.name || "").toLowerCase();
      if (!label.includes(q) && !net.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Top Banner & Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Packages</p>
              <p className="text-xl font-bold text-foreground tabular-nums">
                {bundles.filter((b: any) => b.active).length} <span className="text-xs text-muted-foreground font-medium">/ {bundles.length} total</span>
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Networks Covered</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {networks.length} Networks
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Agent Activation Fee</p>
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400 tabular-nums">
                {formatGHS(Number(activationFee))}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Percent className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Airtime Cashback</p>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                Up to {Math.max(Number(airtimeDiscounts.mtn_discount), Number(airtimeDiscounts.telecel_discount), Number(airtimeDiscounts.at_discount))}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Package Creation & Editor Form */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="border-b border-border bg-secondary/30 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              {editingId ? <Cog className="h-5 w-5 text-primary animate-spin" /> : <Plus className="h-5 w-5 text-primary" />}
              {editingId ? "Edit Data Bundle Package" : "Create New Data Package"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Set customer selling price and agent wholesale base price for any network.
            </p>
          </div>
          {editingId && (
            <Button 
              variant="outline" 
              size="sm" 
              className="rounded-xl text-xs font-semibold"
              onClick={() => {
                setEditingId(null);
                setForm({ network_id: "", size_label: "", size_gb: "", user_price: "", base_price: "" });
              }}
            >
              Cancel Edit
            </Button>
          )}
        </div>

        <div className="p-6 md:p-8">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="group relative border border-border rounded-xl p-4 bg-background/50 transition-all focus-within:ring-2 focus-within:ring-primary/20">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Network Provider *</label>
              <select
                value={form.network_id}
                onChange={(e) => setForm((p) => ({ ...p, network_id: e.target.value }))}
                className="w-full bg-transparent text-sm font-semibold text-foreground outline-none cursor-pointer"
              >
                <option value="">Select Network…</option>
                {networks.map((n: any) => <option key={n.id} value={n.id}>{n.name}</option>)}
              </select>
            </div>
            
            <div className="group relative border border-border rounded-xl p-4 bg-background/50 transition-all focus-within:ring-2 focus-within:ring-primary/20">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Bundle Label / Name *</label>
              <input 
                placeholder="e.g. 2GB Non-Expiry" 
                value={form.size_label} 
                onChange={(e) => {
                  const val = e.target.value;
                  let gb = form.size_gb;
                  if (val.includes("500MB")) gb = "0.5";
                  else if (val.includes("GB")) {
                    const match = val.match(/([\d.]+)GB/i);
                    if (match) gb = match[1];
                  }
                  setForm((p) => ({ ...p, size_label: val, size_gb: gb }));
                }} 
                className="w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/40" 
              />
            </div>
            
            <div className="group relative border border-border rounded-xl p-4 bg-background/50 transition-all focus-within:ring-2 focus-within:ring-primary/20">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Data Size in GB *</label>
              <input 
                placeholder="e.g. 2 or 0.5" 
                type="number"
                step="0.1"
                value={form.size_gb} 
                onChange={(e) => setForm((p) => ({ ...p, size_gb: e.target.value }))} 
                className="w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/40" 
              />
            </div>
            
            <div className="group relative border border-border rounded-xl p-4 bg-background/50 transition-all focus-within:ring-2 focus-within:ring-primary/20">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Customer Selling Price (GHS) *</label>
              <input 
                placeholder="e.g. 10.00" 
                type="number" 
                step="0.01" 
                value={form.user_price} 
                onChange={(e) => setForm((p) => ({ ...p, user_price: e.target.value }))} 
                className="w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/40" 
              />
            </div>
            
            <div className="group relative border border-primary/40 rounded-xl p-4 bg-primary/5 transition-all focus-within:ring-2 focus-within:ring-primary/25">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-primary">Agent Wholesale Price (GHS) *</label>
              <input 
                placeholder="e.g. 8.50" 
                type="number" 
                step="0.01" 
                value={form.base_price} 
                onChange={(e) => setForm((p) => ({ ...p, base_price: e.target.value }))} 
                className="w-full bg-transparent text-sm font-semibold text-primary outline-none placeholder:text-primary/40" 
              />
            </div>

            <div className="flex items-center">
              <Button 
                className="h-14 w-full rounded-xl bg-primary font-bold shadow-soft transition-all hover:scale-[1.01] active:scale-[0.99] text-xs gap-2" 
                onClick={saveBundle}
              >
                {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingId ? "Update Data Package" : "Publish Package"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Inventory & Inline Fast Price Editor */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft space-y-4">
        <div className="border-b border-border bg-secondary/30 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-foreground">Live Data Package Inventory</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Instantly update user selling prices and agent base prices below. Click "Save" on any row to apply changes immediately.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
              <input
                type="text"
                placeholder="Search packages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20 transition-all text-foreground placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Network Selector Pill */}
            <div className="flex bg-secondary/60 p-1 rounded-xl border border-border shrink-0">
              <button
                onClick={() => setActiveNetworkFilter("all")}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-lg transition-all",
                  activeNetworkFilter === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                All Networks
              </button>
              {networks.map((n: any) => (
                <button
                  key={n.id}
                  onClick={() => setActiveNetworkFilter(n.id)}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1",
                    activeNetworkFilter === n.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span>{n.logo_emoji || "📱"}</span>
                  <span>{n.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 overflow-x-auto">
          {filteredBundles.length === 0 ? (
            <div className="p-12 text-center text-sm font-semibold text-muted-foreground">
              No packages match your search filter.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/40 text-muted-foreground uppercase tracking-wider font-semibold border-b border-border">
                <tr>
                  <th className="px-4 py-3 rounded-l-xl">Network</th>
                  <th className="px-4 py-3">Bundle Label</th>
                  <th className="px-4 py-3">Data Size</th>
                  <th className="px-4 py-3 w-40">User Selling Price (GHS)</th>
                  <th className="px-4 py-3 w-40">Agent Wholesale Price (GHS)</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right rounded-r-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredBundles.map((b: any) => {
                  const net = networks.find((n: any) => n.id === b.network_id);
                  const isSaving = savingBundleId === b.id;
                  const currentVals = inlinePrices[b.id] || {
                    user_price: String(b.user_price ?? b.base_price ?? "0"),
                    base_price: String(b.base_price ?? "0")
                  };

                  return (
                    <tr key={b.id} className="group hover:bg-accent transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <span>{net?.logo_emoji || "📦"}</span>
                          <span>{net?.name || "Unknown"}</span>
                        </span>
                      </td>

                      <td className="px-4 py-3 font-bold text-foreground">
                        {b.size_label}
                      </td>

                      <td className="px-4 py-3 font-semibold text-muted-foreground">
                        {(b.size_mb / 1000).toFixed(1).replace(/\.0$/, "")} GB
                      </td>

                      {/* User Price Input */}
                      <td className="px-4 py-3">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold">GH₵</span>
                          <input
                            type="number"
                            step="0.01"
                            value={currentVals.user_price}
                            onChange={(e) => {
                              const val = e.target.value;
                              setInlinePrices(prev => ({
                                ...prev,
                                [b.id]: { ...currentVals, user_price: val }
                              }));
                            }}
                            className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-2 text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                      </td>

                      {/* Agent Wholesale Price Input */}
                      <td className="px-4 py-3">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-primary font-bold">GH₵</span>
                          <input
                            type="number"
                            step="0.01"
                            value={currentVals.base_price}
                            onChange={(e) => {
                              const val = e.target.value;
                              setInlinePrices(prev => ({
                                ...prev,
                                [b.id]: { ...currentVals, base_price: val }
                              }));
                            }}
                            className="h-8 w-full rounded-lg border border-primary/30 bg-primary/5 pl-8 pr-2 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/25"
                          />
                        </div>
                      </td>

                      {/* Active Status Badge */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleBundleActive(b.id, b.active)}
                          className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-all",
                            b.active
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20"
                              : "bg-rose-500/10 text-rose-600 border-rose-500/20 hover:bg-rose-500/20"
                          )}
                          title="Click to toggle active status"
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", b.active ? "bg-emerald-500" : "bg-rose-500")} />
                          {b.active ? "Active" : "Disabled"}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2.5 text-xs font-semibold border-primary/30 text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                            disabled={isSaving}
                            onClick={() => handleInlineSave(b.id)}
                            title="Save updated prices"
                          >
                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                            Save
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-primary transition-all"
                            onClick={() => {
                              setEditingId(b.id);
                              setForm({
                                network_id: b.network_id,
                                size_label: b.size_label,
                                size_gb: String(b.size_mb / 1000),
                                user_price: String(b.user_price ?? b.base_price),
                                base_price: String(b.base_price),
                              });
                            }}
                            title="Edit full package"
                          >
                            <Cog className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-all"
                            onClick={() => removeBundle(b.id)}
                            title="Deactivate package"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Other Platform Pricing Modules */}
      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* Result Checkers Pricing */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="border-b border-border bg-secondary/30 p-5">
            <h3 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Result Checkers Pricing
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Set retail and agent base prices for exam checker vouchers.
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-3">
              {[
                { key: "wassce", name: "WASSCE Checker", userKey: "wassce_user", agentKey: "wassce_agent" },
                { key: "bece", name: "BECE Checker", userKey: "bece_user", agentKey: "bece_agent" },
                { key: "cssps", name: "CSSPS Placement", userKey: "cssps_user", agentKey: "cssps_agent" },
                { key: "novdec", name: "NOVDEC Checker", userKey: "novdec_user", agentKey: "novdec_agent" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-border bg-background/50">
                  <span className="text-xs font-bold text-foreground">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20">
                      <span className="text-[9px] uppercase font-bold text-muted-foreground block mb-0.5">User (GH₵)</span>
                      <input
                        type="number"
                        step="0.5"
                        value={(resultCheckerPrices as any)[item.userKey]}
                        onChange={(e) => setResultCheckerPrices(p => ({ ...p, [item.userKey]: e.target.value }))}
                        className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs font-bold text-foreground outline-none"
                      />
                    </div>
                    <div className="w-20">
                      <span className="text-[9px] uppercase font-bold text-primary block mb-0.5">Agent (GH₵)</span>
                      <input
                        type="number"
                        step="0.5"
                        value={(resultCheckerPrices as any)[item.agentKey]}
                        onChange={(e) => setResultCheckerPrices(p => ({ ...p, [item.agentKey]: e.target.value }))}
                        className="h-7 w-full rounded-md border border-primary/30 bg-primary/5 px-2 text-xs font-bold text-primary outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button
              className="w-full h-10 rounded-xl bg-primary text-xs font-bold shadow-soft transition-all"
              onClick={saveResultCheckerPricing}
              disabled={savingChecker}
            >
              {savingChecker ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Result Checker Prices
            </Button>
          </div>
        </div>

        {/* Airtime Discounts & Cashback */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="border-b border-border bg-secondary/30 p-5">
            <h3 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Airtime Discounts & Cashback
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Set customer cashback & agent commission rates per telco network.
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-3">
              <div className="p-3 rounded-xl border border-border bg-background/50 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-foreground">MTN Airtime Discount</p>
                  <p className="text-[10px] text-muted-foreground">Cashback on recharge</p>
                </div>
                <div className="flex items-center gap-1.5 w-24">
                  <input
                    type="number"
                    step="0.5"
                    value={airtimeDiscounts.mtn_discount}
                    onChange={(e) => setAirtimeDiscounts(p => ({ ...p, mtn_discount: e.target.value }))}
                    className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs font-bold text-foreground outline-none text-right"
                  />
                  <span className="text-xs font-bold text-muted-foreground">%</span>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-border bg-background/50 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-foreground">Telecel Cash / Airtime</p>
                  <p className="text-[10px] text-muted-foreground">Cashback on recharge</p>
                </div>
                <div className="flex items-center gap-1.5 w-24">
                  <input
                    type="number"
                    step="0.5"
                    value={airtimeDiscounts.telecel_discount}
                    onChange={(e) => setAirtimeDiscounts(p => ({ ...p, telecel_discount: e.target.value }))}
                    className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs font-bold text-foreground outline-none text-right"
                  />
                  <span className="text-xs font-bold text-muted-foreground">%</span>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-border bg-background/50 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-foreground">AT (AirtelTigo) Airtime</p>
                  <p className="text-[10px] text-muted-foreground">Cashback on recharge</p>
                </div>
                <div className="flex items-center gap-1.5 w-24">
                  <input
                    type="number"
                    step="0.5"
                    value={airtimeDiscounts.at_discount}
                    onChange={(e) => setAirtimeDiscounts(p => ({ ...p, at_discount: e.target.value }))}
                    className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs font-bold text-foreground outline-none text-right"
                  />
                  <span className="text-xs font-bold text-muted-foreground">%</span>
                </div>
              </div>
            </div>

            <Button
              className="w-full h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-soft transition-all"
              onClick={saveAirtimeDiscounts}
              disabled={savingAirtime}
            >
              {savingAirtime ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Airtime Discounts
            </Button>
          </div>
        </div>

        {/* Onboarding & Agent Fees */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="border-b border-border bg-secondary/30 p-5">
            <h3 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              <Settings className="h-4 w-4 text-purple-500" />
              Agent Onboarding Fee
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              One-time activation fee required when onboarding as an agent.
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Activation Fee (GHS)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">GH₵</span>
                <Input 
                  value={activationFee} 
                  onChange={(e) => setActivationFee(e.target.value)} 
                  className="h-11 rounded-xl bg-background pl-10 font-bold text-sm text-foreground focus-visible:ring-2 focus-visible:ring-primary/20 border-border" 
                />
              </div>
            </div>

            <div className="p-3 rounded-xl border border-border bg-secondary/20 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">💡 Referral Reward Split:</p>
              <p>40% (GH₵{(Number(activationFee) * 0.4).toFixed(2)}) is automatically rewarded to the recruiter when a new agent activates.</p>
            </div>

            <Button 
              className="w-full h-10 rounded-xl bg-foreground text-background text-xs font-bold transition-all hover:opacity-90 active:scale-95" 
              onClick={saveActivationFee}
              disabled={savingFee}
            >
              {savingFee ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Update Activation Fee
            </Button>
          </div>
        </div>

      </div>

    </div>
  );
}
