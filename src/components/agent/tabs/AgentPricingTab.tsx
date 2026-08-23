import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  ArrowRight, 
  Check, 
  CheckCircle2, 
  DollarSign, 
  ExternalLink, 
  Info, 
  Loader2, 
  Percent, 
  RefreshCw, 
  Save, 
  Search, 
  SlidersHorizontal, 
  Smartphone, 
  Sparkles, 
  Store, 
  Tag, 
  TrendingUp, 
  Zap 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatGHS } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AgentPricingTab({ agentProfile, userId }: { agentProfile: any; userId?: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const storeUrl = `${window.location.origin}/store/${agentProfile.store_slug}`;

  const [activeNetworkFilter, setActiveNetworkFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [activeMap, setActiveMap] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // Bulk tool state
  const [bulkMarkupType, setBulkMarkupType] = useState<"fixed" | "percent">("fixed");
  const [bulkValue, setBulkValue] = useState<string>("1.00");

  const { data: payload, isLoading } = useQuery({
    queryKey: ["agent-pricing-tab", agentProfile.id],
    queryFn: async () => {
      const [{ data: networks }, { data: bundles }, { data: myPrices }] = await Promise.all([
        supabase.from("networks").select("id, name, code, logo_emoji").eq("active", true).order("sort_order"),
        supabase.from("bundles").select("id, network_id, size_label, size_mb, base_price, user_price").eq("active", true).order("size_mb", { ascending: true }),
        supabase.from("agent_bundle_prices").select("bundle_id, sell_price, active").eq("agent_id", agentProfile.id),
      ]);

      const priceMap: Record<string, number> = {};
      const statusMap: Record<string, boolean> = {};

      (myPrices ?? []).forEach((r: any) => {
        priceMap[r.bundle_id] = Number(r.sell_price);
        statusMap[r.bundle_id] = r.active ?? true;
      });

      return { 
        networks: networks ?? [], 
        bundles: bundles ?? [], 
        priceMap,
        statusMap 
      };
    },
  });

  useEffect(() => {
    if (payload?.bundles) {
      const p: Record<string, string> = {};
      const a: Record<string, boolean> = {};

      payload.bundles.forEach((b: any) => {
        // If agent has custom price, use it; otherwise fallback to recommended user_price or base_price
        const existingCustomPrice = payload.priceMap[b.id];
        const defaultSellPrice = b.user_price ? Number(b.user_price) : Number(b.base_price) + 1.0;
        p[b.id] = existingCustomPrice != null ? String(existingCustomPrice) : String(defaultSellPrice);

        const existingStatus = payload.statusMap[b.id];
        a[b.id] = existingStatus !== undefined ? existingStatus : true;
      });

      setPrices(p);
      setActiveMap(a);
    }
  }, [payload]);

  const handlePriceChange = (bundleId: string, val: string) => {
    setPrices(prev => ({ ...prev, [bundleId]: val }));
  };

  const handleToggleActive = (bundleId: string) => {
    setActiveMap(prev => ({ ...prev, [bundleId]: !prev[bundleId] }));
  };

  const applyBulkMarkup = () => {
    const val = Number(bulkValue);
    if (isNaN(val) || val <= 0) {
      toast({ title: "Enter a valid markup value", variant: "destructive" });
      return;
    }

    const updated: Record<string, string> = { ...prices };
    (payload?.bundles ?? []).forEach((b: any) => {
      if (activeNetworkFilter === "all" || b.network_id === activeNetworkFilter) {
        const cost = Number(b.base_price);
        let newPrice = cost;
        if (bulkMarkupType === "fixed") {
          newPrice = cost + val;
        } else {
          newPrice = cost * (1 + val / 100);
        }
        updated[b.id] = newPrice.toFixed(2);
      }
    });

    setPrices(updated);
    toast({ 
      title: "Bulk markup applied! ⚡", 
      description: `Updated prices for ${activeNetworkFilter === "all" ? "all networks" : "selected network"}. Click 'Save All Prices' to publish.` 
    });
  };

  const resetToRecommended = () => {
    const updated: Record<string, string> = { ...prices };
    (payload?.bundles ?? []).forEach((b: any) => {
      if (activeNetworkFilter === "all" || b.network_id === activeNetworkFilter) {
        const rec = b.user_price ? Number(b.user_price) : Number(b.base_price) + 1.0;
        updated[b.id] = rec.toFixed(2);
      }
    });
    setPrices(updated);
    toast({ title: "Reset to default recommended retail prices! 🔄" });
  };

  const saveAllPrices = async () => {
    setSaving(true);
    try {
      const rows = (payload?.bundles ?? []).map((b: any) => {
        const rawPrice = Number(prices[b.id]);
        const cost = Number(b.base_price);
        // Ensure price is at least cost price to protect agent margin
        const sellPrice = isNaN(rawPrice) || rawPrice <= 0 ? cost : rawPrice;
        const isActive = activeMap[b.id] !== undefined ? activeMap[b.id] : true;

        return {
          agent_id: agentProfile.id,
          bundle_id: b.id,
          sell_price: sellPrice,
          active: isActive,
        };
      });

      if (rows.length > 0) {
        const { error } = await supabase
          .from("agent_bundle_prices")
          .upsert(rows as any, { onConflict: "agent_id,bundle_id" });

        if (error) throw error;
      }

      toast({ title: "Storefront Prices Saved & Live! 🎉", description: "Your customers will see your updated prices immediately." });
      qc.invalidateQueries({ queryKey: ["agent-pricing-tab", agentProfile.id] });
      qc.invalidateQueries({ queryKey: ["agent-store-bundles", agentProfile.id] });
    } catch (err: any) {
      toast({ title: "Failed to save prices", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16 text-muted-foreground gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm font-semibold">Loading your store pricing catalog…</p>
      </div>
    );
  }

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
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* ── HEADER BANNER ── */}
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-secondary/30 p-6 shadow-soft">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Tag className="h-4 w-4" />
              </span>
              <h2 className="text-xl font-bold tracking-tight text-foreground">Storefront Pricing & Profit Margins</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
              Control exactly how much you charge for each data bundle on your store link. You keep <strong>100% of the profit margin</strong> between your wholesale cost and selling price.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={storeUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-border bg-background hover:bg-secondary text-xs font-semibold text-foreground transition-all shadow-sm"
            >
              <Store className="h-4 w-4 text-primary" />
              <span>Preview My Store</span>
              <ExternalLink className="h-3 w-3 opacity-60 ml-0.5" />
            </a>

            <Button
              className="h-10 px-6 rounded-xl bg-primary font-bold text-xs shadow-soft transition-all hover:scale-[1.02] active:scale-[0.98] gap-2"
              onClick={saveAllPrices}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save All Prices
            </Button>
          </div>
        </div>
      </div>

      {/* ── BULK MARKUP QUICK TOOL ── */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Fast Bulk Profit Markup</p>
              <p className="text-[11px] text-muted-foreground">Quickly add a fixed profit or percentage markup to all bundles.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-secondary/50 p-0.5 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setBulkMarkupType("fixed")}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                  bulkMarkupType === "fixed" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                + Fixed GHS (GH₵)
              </button>
              <button
                type="button"
                onClick={() => setBulkMarkupType("percent")}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                  bulkMarkupType === "percent" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                + Percentage (%)
              </button>
            </div>

            <div className="relative w-28">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                {bulkMarkupType === "fixed" ? "GH₵" : "%"}
              </span>
              <input
                type="number"
                step={bulkMarkupType === "fixed" ? "0.5" : "1"}
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-2 text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                placeholder={bulkMarkupType === "fixed" ? "1.00" : "15"}
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-xl text-xs font-bold border-amber-500/30 text-amber-600 bg-amber-500/5 hover:bg-amber-500 hover:text-white transition-all"
              onClick={applyBulkMarkup}
            >
              Apply Markup
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground"
              onClick={resetToRecommended}
            >
              Reset to Defaults
            </Button>
          </div>
        </div>
      </div>

      {/* ── BUNDLE PRICING TABLE ── */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft space-y-4">
        
        {/* Search & Network Selector */}
        <div className="border-b border-border bg-secondary/30 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex bg-secondary/70 p-1 rounded-xl border border-border shrink-0">
            <button
              onClick={() => setActiveNetworkFilter("all")}
              className={cn(
                "px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all",
                activeNetworkFilter === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              All Networks ({bundles.length})
            </button>
            {networks.map((n: any) => {
              const count = bundles.filter((b: any) => b.network_id === n.id).length;
              return (
                <button
                  key={n.id}
                  onClick={() => setActiveNetworkFilter(n.id)}
                  className={cn(
                    "px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
                    activeNetworkFilter === n.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span>{n.logo_emoji || "📱"}</span>
                  <span>{n.name}</span>
                  <span className="text-[10px] opacity-70">({count})</span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <input
              type="text"
              placeholder="Search package (e.g. 1GB, 5GB)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20 transition-all text-foreground placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        {/* Pricing List Table */}
        <div className="p-5 overflow-x-auto">
          {filteredBundles.length === 0 ? (
            <div className="p-12 text-center text-sm font-semibold text-muted-foreground">
              No packages found matching your filter.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/40 text-muted-foreground uppercase tracking-wider font-semibold border-b border-border">
                <tr>
                  <th className="px-4 py-3 rounded-l-xl">Network & Package</th>
                  <th className="px-4 py-3">Your Cost (Wholesale)</th>
                  <th className="px-4 py-3 w-48">Your Selling Price (GH₵)</th>
                  <th className="px-4 py-3">Your Profit / Margin</th>
                  <th className="px-4 py-3 text-center rounded-r-xl">Visible on Store</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredBundles.map((b: any) => {
                  const net = networks.find((n: any) => n.id === b.network_id);
                  const cost = Number(b.base_price);
                  const sell = Number(prices[b.id] ?? cost);
                  const profit = sell - cost;
                  const profitPercent = cost > 0 ? Math.round((profit / cost) * 100) : 0;
                  const isVisible = activeMap[b.id] !== undefined ? activeMap[b.id] : true;
                  const isUnderpriced = sell < cost;

                  return (
                    <tr key={b.id} className="group hover:bg-accent/40 transition-colors">
                      {/* Network & Name */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary border border-border text-sm">
                            {net?.logo_emoji || "📱"}
                          </span>
                          <div>
                            <p className="font-bold text-foreground group-hover:text-primary transition-colors text-sm">
                              {b.size_label}
                            </p>
                            <p className="text-[10px] font-medium text-muted-foreground">
                              {net?.name} • {(b.size_mb / 1000).toFixed(1).replace(/\.0$/, "")} GB
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Cost Price */}
                      <td className="px-4 py-3.5">
                        <div className="font-mono font-bold text-xs text-muted-foreground">
                          {formatGHS(cost)}
                        </div>
                        <span className="text-[9px] uppercase font-bold text-muted-foreground/60 tracking-wider">Base Cost</span>
                      </td>

                      {/* Selling Price Input */}
                      <td className="px-4 py-3.5">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-primary">GH₵</span>
                          <input
                            type="number"
                            step="0.10"
                            value={prices[b.id] ?? ""}
                            onChange={(e) => handlePriceChange(b.id, e.target.value)}
                            className={cn(
                              "h-9 w-full rounded-xl border bg-background pl-9 pr-3 text-xs font-bold text-foreground outline-none focus:ring-2 transition-all",
                              isUnderpriced 
                                ? "border-rose-500 focus:ring-rose-500/20 bg-rose-500/5 text-rose-600" 
                                : "border-primary/40 focus:ring-primary/20 hover:border-primary"
                            )}
                            placeholder="0.00"
                          />
                        </div>
                        {isUnderpriced && (
                          <span className="text-[9px] font-bold text-rose-500 mt-1 block">
                            ⚠️ Selling below wholesale cost!
                          </span>
                        )}
                      </td>

                      {/* Calculated Profit Margin */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums border",
                            profit > 0 
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : profit === 0
                              ? "bg-muted text-muted-foreground border-border"
                              : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                          )}>
                            <TrendingUp className="h-3 w-3" />
                            +{formatGHS(Math.max(0, profit))} ({profitPercent}%)
                          </span>
                        </div>
                        <span className="text-[9px] text-muted-foreground font-medium mt-0.5 block">per purchase</span>
                      </td>

                      {/* Visible Toggle */}
                      <td className="px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(b.id)}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer",
                            isVisible 
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20" 
                              : "bg-secondary text-muted-foreground border-border hover:text-foreground"
                          )}
                          title="Toggle bundle visibility on your public store"
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", isVisible ? "bg-emerald-500" : "bg-muted-foreground")} />
                          {isVisible ? "Active" : "Hidden"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer save prompt */}
        <div className="border-t border-border bg-secondary/30 p-4 flex items-center justify-between">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            <span>Remember to save your changes to publish updated prices to your live storefront.</span>
          </div>

          <Button
            className="h-10 px-6 rounded-xl bg-primary font-bold text-xs shadow-soft transition-all hover:scale-[1.02] active:scale-[0.98] gap-2"
            onClick={saveAllPrices}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save All Prices
          </Button>
        </div>

      </div>

    </div>
  );
}
