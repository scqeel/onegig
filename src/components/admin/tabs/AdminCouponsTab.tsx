import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gift, Loader2, Search, Trash2 } from "lucide-react";
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
import { formatGHS } from "@/lib/format";

export function AdminCouponsTab() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const [code, setCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [maxUses, setMaxUses] = useState("100");
  const [agentId, setAgentId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: coupons = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-all-coupons"],
    queryFn: async () => {
      const { data } = await supabase
        .from("coupons")
        .select(`
          *,
          agent_profiles(store_name, store_slug)
        `)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["admin-active-agents-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_profiles")
        .select("id, store_name, store_slug")
        .eq("activation_paid", true);
      return data ?? [];
    },
  });

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !discountAmount || !maxUses) return;

    setIsSubmitting(true);
    try {
      const cleanCode = code.trim().toUpperCase();
      const discount = Number(discountAmount);
      const max = parseInt(maxUses);

      if (discount <= 0) {
        toast({ title: "Error", description: "Discount amount must be positive.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      if (max <= 0) {
        toast({ title: "Error", description: "Max uses must be positive.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase
        .from("coupons")
        .insert({
          code: cleanCode,
          discount_amount: discount,
          max_uses: max,
          agent_id: agentId || null,
          active: true,
        });

      if (error) {
        if (error.code === "23505") {
          throw new Error("A coupon with this promo code already exists.");
        }
        throw error;
      }

      toast({ title: "Success", description: `Promo code ${cleanCode} created successfully!` });
      setCode("");
      setDiscountAmount("");
      setMaxUses("100");
      setAgentId("");
      setCreateOpen(false);
      refetch();
    } catch (err: any) {
      toast({ title: "Failed to create", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCouponActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("coupons")
      .update({ active: !currentStatus })
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: "Failed to toggle status.", variant: "destructive" });
    } else {
      toast({ title: "Status Updated", description: `Promo code has been ${currentStatus ? "deactivated" : "activated"}.` });
      refetch();
    }
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this promo coupon?")) return;
    const { error } = await supabase
      .from("coupons")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: "Failed to delete coupon.", variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Promo code has been removed." });
      refetch();
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredCoupons = coupons.filter((c: any) => 
    c.code.toLowerCase().includes(q) || 
    (c.agent_profiles?.store_name ?? "Global Platform").toLowerCase().includes(q)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-[2rem] border border-border/45 bg-card p-6 md:p-8 shadow-soft">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
            <Gift className="h-5.5 w-5.5 text-rose-500" /> Promo Coupons & Vouchers
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Manage global platform-wide vouchers and track agent-sponsored discount codes.</p>
        </div>

        <Button 
          onClick={() => setCreateOpen(true)}
          className="h-10.5 rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground font-bold px-5 flex items-center gap-1.5 shadow-soft transition-all hover:scale-105 active:scale-95 shrink-0 self-start sm:self-auto text-xs"
        >
          <Gift className="h-4 w-4" /> Create Platform Coupon
        </Button>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/50 px-4 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
        <Search className="h-4 w-4 text-muted-foreground/60" />
        <input
          type="text"
          placeholder="Search by code, sponsor..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent text-xs font-semibold outline-none placeholder:text-muted-foreground/50 text-foreground"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filteredCoupons.length === 0 ? (
        <div className="text-center py-16 border border-border/40 rounded-[2rem] bg-card/25 space-y-4 shadow-soft">
          <Gift className="mx-auto h-12 w-12 text-muted-foreground/30 animate-bounce" />
          <div>
            <p className="font-bold text-foreground text-sm">No promo coupons found</p>
            <p className="text-xs text-muted-foreground/80 mt-1">Get started by creating a platform-wide coupon.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[2rem] border border-border/45 bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border/40 bg-secondary/30 text-muted-foreground/80 font-bold uppercase tracking-widest">
                  <th className="px-6 py-4">Promo Code</th>
                  <th className="px-6 py-4">Discount</th>
                  <th className="px-6 py-4">Sponsor / Store</th>
                  <th className="px-6 py-4">Uses</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredCoupons.map((c: any) => {
                  const isExhausted = Number(c.current_uses) >= Number(c.max_uses);
                  const isActive = c.active && !isExhausted;
                  return (
                    <tr key={c.id} className="group hover:bg-primary/[0.01] transition-colors">
                      <td className="px-6 py-4 font-mono font-bold uppercase text-foreground text-sm tracking-wider group-hover:text-primary transition-colors">{c.code}</td>
                      <td className="px-6 py-4 font-bold text-rose-500 text-sm">{formatGHS(c.discount_amount)}</td>
                      <td className="px-6 py-4">
                        {c.agent_profiles ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground">{c.agent_profiles.store_name}</span>
                            <span className="text-[9px] text-muted-foreground/85 font-mono">Store: /store/{c.agent_profiles.store_slug}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-primary/10 text-primary border border-primary/20 shadow-sm">
                            Global Platform
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold text-muted-foreground/90 tabular-nums">
                        {c.current_uses} / {c.max_uses}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${isActive ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-secondary text-muted-foreground border border-border'}`}>
                          {isActive ? "Active" : isExhausted ? "Exhausted" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className={`h-8 rounded-xl text-xs font-bold bg-background/50 transition-all ${c.active ? "text-amber-500 border-amber-500/20 hover:bg-amber-500/10 hover:border-amber-500/30" : "text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10 hover:border-emerald-500/30"}`}
                            onClick={() => toggleCouponActive(c.id, c.active)}
                          >
                            {c.active ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 rounded-xl p-0 text-destructive border border-border/30 hover:bg-destructive/10 hover:border-destructive/20 transition-all"
                            onClick={() => deleteCoupon(c.id)}
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
          </div>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-[94vw] max-w-md rounded-[2rem] border border-border/50 p-6 md:p-8 bg-card shadow-float">
          <DialogHeader>
            <DialogTitle className="text-left text-lg font-bold text-foreground flex items-center gap-2">
              <Gift className="h-5.5 w-5.5 text-rose-500" /> Create Platform Coupon
            </DialogTitle>
            <DialogDescription className="text-left text-xs text-muted-foreground/80 mt-1 leading-relaxed">
              Add a new promo discount code. It can be a global admin coupon or assigned to a specific store.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCoupon} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Promo Code</label>
              <Input
                placeholder="e.g. WELCOME10"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-10.5 rounded-xl border-border/60 bg-background/50 font-semibold uppercase focus-visible:ring-primary/20 text-foreground placeholder:text-muted-foreground/30 text-xs"
                required
              />
              <p className="text-[9px] text-muted-foreground/75 font-medium">Case-insensitive alphanumeric string.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Discount (GHS)</label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 10.00"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  className="h-10.5 rounded-xl border-border/60 bg-background/50 font-semibold focus-visible:ring-primary/20 text-foreground text-xs placeholder:text-muted-foreground/30"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Max Uses</label>
                <Input
                  type="number"
                  placeholder="e.g. 500"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  className="h-10.5 rounded-xl border-border/60 bg-background/50 font-semibold focus-visible:ring-primary/20 text-foreground text-xs placeholder:text-muted-foreground/30"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Assign to Store (Optional)</label>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="w-full h-10.5 rounded-xl border border-border/60 bg-background/50 px-4 text-xs font-semibold focus:ring-2 focus:ring-primary/20 focus:outline-none text-foreground cursor-pointer"
              >
                <option value="">Global Coupon (Platform Sponsored)</option>
                {agents.map((ag: any) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.store_name} (/store/{ag.store_slug})
                  </option>
                ))}
              </select>
              <p className="text-[9px] text-muted-foreground/75 font-medium">Leave as Global if the coupon is sponsored by the platform for all stores.</p>
            </div>

            <div className="pt-3">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 rounded-xl font-bold bg-primary hover:bg-primary/95 text-primary-foreground transition-all hover:scale-[1.02] active:scale-[0.98] text-xs shadow-soft"
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gift className="mr-2 h-4 w-4" />}
                Generate Coupon Code
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
