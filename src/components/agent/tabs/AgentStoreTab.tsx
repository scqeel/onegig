import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity, Check, CheckCircle2, ChevronRight, Clock, Copy,
  ExternalLink, Eye, Gift, Loader2, ShoppingCart, Store,
  TrendingUp, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatGHS, timeAgo } from "@/lib/format";

export function AgentStoreTab({ agentProfile, userId }: { agentProfile: any; userId?: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const storeUrl = `${window.location.origin}/store/${agentProfile.store_slug}`;
  const [copied, setCopied] = useState(false);

  const copyUrl = () => {
    navigator.clipboard.writeText(storeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const { data: analytics, isLoading: loadingAnalytics } = useQuery({
    queryKey: ["agent-store-analytics", agentProfile.id],
    queryFn: async () => {
      const { data: events, error } = await supabase
        .from("storefront_analytics")
        .select("*")
        .eq("agent_id", agentProfile.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching analytics:", error);
        return { events: [], pageViews: 0, checkouts: 0, successes: 0, uniqueVisitors: 0 };
      }

      const pageViews = (events ?? []).filter(e => e.event_type === "page_view").length;
      const checkouts = (events ?? []).filter(e => e.event_type === "checkout_initiated").length;
      const successes = (events ?? []).filter(e => e.event_type === "payment_success").length;

      const uniqueTokens = new Set((events ?? []).map(e => e.session_token));
      const uniqueVisitors = uniqueTokens.size;

      return {
        events: events ?? [],
        pageViews,
        checkouts,
        successes,
        uniqueVisitors
      };
    },
    refetchInterval: 5000,
  });

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
  const [targetProfit, setTargetProfit] = useState(500);

  const { data: coupons = [], isLoading: loadingCoupons, refetch: refetchCoupons } = useQuery({
    queryKey: ["agent-coupons", agentProfile.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("coupons")
        .select("*")
        .eq("agent_id", agentProfile.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newDiscount, setNewDiscount] = useState("");
  const [newMaxUses, setNewMaxUses] = useState("100");
  const [isCreatingCoupon, setIsCreatingCoupon] = useState(false);

  const toggleCouponActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("coupons")
        .update({ active: !currentStatus })
        .eq("id", id);
      if (error) throw error;
      toast({ title: `Coupon ${currentStatus ? "deactivated" : "activated"} successfully!` });
      refetchCoupons();
    } catch (e: any) {
      toast({ title: "Failed to update coupon status", variant: "destructive" });
    }
  };

  const deleteCoupon = async (id: string) => {
    try {
      const { error } = await supabase
        .from("coupons")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Coupon deleted successfully!" });
      refetchCoupons();
    } catch (e: any) {
      toast({ title: "Failed to delete coupon", variant: "destructive" });
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newDiscount || !newMaxUses) return;

    setIsCreatingCoupon(true);
    try {
      const cleanCode = newCode.trim().toUpperCase();
      const discount = Number(newDiscount);
      const maxUses = parseInt(newMaxUses);

      if (discount <= 0) {
        toast({ title: "Discount must be greater than 0", variant: "destructive" });
        setIsCreatingCoupon(false);
        return;
      }

      if (maxUses <= 0) {
        toast({ title: "Max uses must be greater than 0", variant: "destructive" });
        setIsCreatingCoupon(false);
        return;
      }

      const minBundlePrice = (payload?.bundles ?? []).reduce((min: number, b: any) => {
        const sell = Number(prices[b.id] ?? b.base_price);
        return sell < min ? sell : min;
      }, 999999);

      if (discount >= minBundlePrice && minBundlePrice !== 999999) {
        toast({
          title: "Coupon discount too high",
          description: `To protect your margins, the discount cannot exceed your cheapest data bundle price (${formatGHS(minBundlePrice)}).`,
          variant: "destructive",
        });
        setIsCreatingCoupon(false);
        return;
      }

      const { error } = await supabase
        .from("coupons")
        .insert({
          code: cleanCode,
          discount_amount: discount,
          max_uses: maxUses,
          agent_id: agentProfile.id,
          active: true
        });

      if (error) {
        if (error.code === "23505") {
          throw new Error("A coupon with this promo code already exists.");
        }
        throw error;
      }

      toast({ title: "Coupon created successfully!" });
      setNewCode("");
      setNewDiscount("");
      setNewMaxUses("100");
      setCreateOpen(false);
      refetchCoupons();
    } catch (e: any) {
      toast({ title: e.message || "Failed to create coupon", variant: "destructive" });
    } finally {
      setIsCreatingCoupon(false);
    }
  };

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

  const totalViews = analytics?.pageViews || 0;
  const totalCheckouts = analytics?.checkouts || 0;
  const totalSuccesses = analytics?.successes || 0;
  const totalVisitors = analytics?.uniqueVisitors || 0;
  
  const checkoutConversion = totalVisitors > 0 
    ? Math.round((totalSuccesses / totalVisitors) * 100) 
    : 0;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* ── STORE TRAFFIC ANALYTICS HUB ── */}
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
        <div className="border-b border-border/60 bg-[#080c1a] px-5 py-4 md:px-6 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="h-4.5 w-4.5 text-rose-500 animate-pulse" /> Live Storefront Traffic Analytics
            </h2>
            <p className="mt-0.5 text-xs text-white/50">Monitor storefront traffic, conversion funnel, and live visitor activity.</p>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" /> Realtime
          </span>
        </div>

        <div className="p-5 md:p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                <Users className="h-3.5 w-3.5 text-primary" /> Unique Visitors
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">{loadingAnalytics ? "..." : totalVisitors}</p>
            </div>
            
            <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                <Eye className="h-3.5 w-3.5 text-blue-500" /> Total Page Views
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">{loadingAnalytics ? "..." : totalViews}</p>
            </div>

            <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                <ShoppingCart className="h-3.5 w-3.5 text-amber-500" /> Checkout Started
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">{loadingAnalytics ? "..." : totalCheckouts}</p>
            </div>

            <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> Conversion Rate
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{loadingAnalytics ? "..." : `${checkoutConversion}%`}</p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Storefront Conversion Funnel</h3>
            <div className="flex flex-col md:flex-row items-stretch gap-4">
              <div className="flex-1 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5 flex flex-col justify-between relative overflow-hidden group hover:bg-blue-500/10 transition-all shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-500">
                    <Eye className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">1. Awareness</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground tabular-nums">{totalViews}</p>
                  <p className="text-xs text-muted-foreground">Storefront Page Views</p>
                </div>
                <div className="mt-4 text-[10px] font-bold text-blue-500">100% Baseline</div>
              </div>

              <div className="hidden md:flex items-center justify-center text-muted-foreground/30">
                <ChevronRight className="h-6 w-6" />
              </div>

              <div className="flex-1 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 flex flex-col justify-between relative overflow-hidden group hover:bg-amber-500/10 transition-all shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-500">
                    <ShoppingCart className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">2. Intent</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground tabular-nums">{totalCheckouts}</p>
                  <p className="text-xs text-muted-foreground">Checkout Initiations</p>
                </div>
                <div className="mt-4 text-[10px] font-bold text-amber-500">
                  {totalViews > 0 ? `${Math.round((totalCheckouts / totalViews) * 100)}%` : "0%"} Conversion
                </div>
              </div>

              <div className="hidden md:flex items-center justify-center text-muted-foreground/30">
                <ChevronRight className="h-6 w-6" />
              </div>

              <div className="flex-1 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 flex flex-col justify-between relative overflow-hidden group hover:bg-emerald-500/10 transition-all shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-500">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">3. Purchase</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground tabular-nums">{totalSuccesses}</p>
                  <p className="text-xs text-muted-foreground">Successful Orders</p>
                </div>
                <div className="mt-4 text-[10px] font-bold text-emerald-500">
                  {totalCheckouts > 0 ? `${Math.round((totalSuccesses / totalCheckouts) * 100)}%` : "0%"} checkout-to-sale
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
    </div>
  );
}
