import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Loader2, Network } from "lucide-react";
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

export function AgentSubAgentsTab({ agentProfile }: { agentProfile: any }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [selectedSubAgent, setSelectedSubAgent] = useState<any | null>(null);
  const [overrideForm, setOverrideForm] = useState<Record<string, string>>({});
  const [savingOverrides, setSavingOverrides] = useState(false);

  const inviteUrl = `${window.location.origin}/join/${agentProfile.store_slug}`;

  const { data: subAgents, isLoading } = useQuery({
    queryKey: ["agent-sub-agents", agentProfile.id],
    queryFn: async () => {
      const { data: agents, error } = await supabase
        .from("agent_profiles")
        .select("id, user_id, store_name, store_slug, activation_paid, created_at")
        .eq("parent_agent_id", agentProfile.id)
        .order("created_at", { ascending: false });
        
      if (error) {
        console.error("Error fetching sub-agents:", error);
        return [];
      }
      if (!agents || agents.length === 0) return [];

      const userIds = agents.map((a) => a.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", userIds);

      return agents.map((agent) => {
        const profile = profiles?.find((p) => p.id === agent.user_id);
        return {
          ...agent,
          profiles: profile ? { full_name: profile.full_name, phone: profile.phone } : null,
        };
      });
    },
  });

  const copyUrl = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Invite link copied!" });
  };

  const { data: overridePayload, isLoading: loadingOverrides } = useQuery({
    queryKey: ["sub-agent-overrides", selectedSubAgent?.id],
    enabled: !!selectedSubAgent?.id,
    queryFn: async () => {
      const [{ data: bundles }, { data: networks }, { data: existing }, { data: myPrices }] = await Promise.all([
        supabase.from("bundles").select("id, network_id, size_label, base_price").eq("active", true).order("size_mb"),
        supabase.from("networks").select("id, name, code, logo_emoji").eq("active", true),
        supabase.from("sub_agent_wholesale_overrides").select("bundle_id, wholesale_price").eq("sub_agent_id", selectedSubAgent!.id).eq("parent_agent_id", agentProfile.id),
        supabase.from("agent_bundle_prices").select("bundle_id, sell_price").eq("agent_id", agentProfile.id).eq("active", true),
      ]);

      const overrideMap: Record<string, number> = {};
      (existing ?? []).forEach((r: any) => {
        overrideMap[r.bundle_id] = Number(r.wholesale_price);
      });

      const parentPriceMap: Record<string, number> = {};
      (myPrices ?? []).forEach((r: any) => {
        parentPriceMap[r.bundle_id] = Number(r.sell_price);
      });

      return {
        bundles: (bundles ?? []).map(b => ({
          ...b,
          network: (networks ?? []).find(n => n.id === b.network_id),
          overridePrice: overrideMap[b.id] || null,
          parentPrice: parentPriceMap[b.id] != null ? parentPriceMap[b.id] : Number(b.base_price),
        }))
      };
    }
  });

  useEffect(() => {
    if (overridePayload?.bundles) {
      const s: Record<string, string> = {};
      overridePayload.bundles.forEach(b => {
        s[b.id] = b.overridePrice != null ? String(b.overridePrice) : "";
      });
      setOverrideForm(s);
    }
  }, [overridePayload?.bundles]);

  const saveOverrides = async () => {
    if (!selectedSubAgent) return;
    setSavingOverrides(true);
    
    try {
      const rows = [];
      const deletes = [];
      
      for (const b of overridePayload?.bundles || []) {
        const val = overrideForm[b.id]?.trim();
        if (val && Number(val) > 0) {
          if (Number(val) < Number(b.base_price)) {
            toast({ 
              title: "Invalid Price", 
              description: `Wholesale price for ${b.size_label} cannot be lower than admin base price of GH₵ ${b.base_price}.`,
              variant: "destructive"
            });
            setSavingOverrides(false);
            return;
          }
          rows.push({
            parent_agent_id: agentProfile.id,
            sub_agent_id: selectedSubAgent.id,
            bundle_id: b.id,
            wholesale_price: Number(val),
          });
        } else {
          deletes.push(b.id);
        }
      }

      if (rows.length > 0) {
        const { error: upsertErr } = await supabase
          .from("sub_agent_wholesale_overrides")
          .upsert(rows, { onConflict: "sub_agent_id,bundle_id" });
        if (upsertErr) throw upsertErr;
      }

      if (deletes.length > 0) {
        const { error: deleteErr } = await supabase
          .from("sub_agent_wholesale_overrides")
          .delete()
          .eq("sub_agent_id", selectedSubAgent.id)
          .eq("parent_agent_id", agentProfile.id)
          .in("bundle_id", deletes);
        if (deleteErr) throw deleteErr;
      }

      toast({ title: "Wholesale rates saved successfully!" });
      setSelectedSubAgent(null);
    } catch (e: any) {
      toast({ title: "Failed to save rates", description: e.message, variant: "destructive" });
    } finally {
      setSavingOverrides(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
        <div className="border-b border-border/60 bg-primary/5 px-5 py-4 md:px-6">
          <h2 className="text-base font-bold text-foreground">Sub-Agents</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Invite and manage your network of sub-agents.</p>
        </div>
        <div className="p-5 md:p-6 space-y-6">
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-foreground">Your Invite Link</h3>
            <p className="text-xs text-muted-foreground">Share this link to onboard new sub-agents under your account. They will inherit your base pricing initially.</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 truncate rounded-xl border border-border bg-secondary/40 px-3 py-2.5 font-mono text-sm text-muted-foreground">
                {inviteUrl}
              </div>
              <Button type="button" variant="outline" size="sm" className="h-10 shrink-0 rounded-xl px-3" onClick={copyUrl}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-border/60">
            <h3 className="text-sm font-bold text-foreground">Your Network</h3>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : subAgents?.length === 0 ? (
              <div className="text-center py-8">
                <Network className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">No sub-agents yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Share your invite link to start building your network</p>
              </div>
            ) : (
              <div className="space-y-3">
                {subAgents?.map((sa: any) => (
                  <div key={sa.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-secondary/20 hover:border-primary/20 transition-all duration-300">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-foreground">{sa.store_name}</p>
                        {!sa.activation_paid && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 text-[10px] font-bold">Pending Activation</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {sa.profiles?.full_name || 'No Name'} · {sa.profiles?.phone || 'No Phone'}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {sa.activation_paid && (
                        <Button 
                          onClick={() => setSelectedSubAgent(sa)}
                          variant="outline" 
                          size="sm" 
                          className="h-9 px-3 rounded-lg text-xs font-bold bg-white/5 border-border hover:bg-secondary/40 text-foreground"
                        >
                          Wholesale Rates
                        </Button>
                      )}
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Joined {timeAgo(sa.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!selectedSubAgent} onOpenChange={(open) => { if (!open) setSelectedSubAgent(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Configure Wholesale Overrides</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Set custom bundle wholesale costs for <span className="font-bold text-foreground">{selectedSubAgent?.store_name}</span>.
              Leaving an override empty restores standard pricing (sub-agent pays standard admin base rates).
            </DialogDescription>
          </DialogHeader>

          {loadingOverrides ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-4 pt-4">
              <div className="overflow-hidden rounded-xl border border-border/60 bg-secondary/15">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-secondary/40 border-b border-border/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3">Bundle</th>
                      <th className="px-4 py-3">Base Cost</th>
                      <th className="px-4 py-3">Your Sell Price</th>
                      <th className="px-4 py-3">Sub Wholesale Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {overridePayload?.bundles.map((b: any) => (
                      <tr key={b.id} className="hover:bg-secondary/10 transition-colors">
                        <td className="px-4 py-3.5 font-bold flex items-center gap-1.5">
                          <span className="text-sm shrink-0">{b.network?.logo_emoji}</span>
                          <span>{b.size_label}</span>
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground font-mono">{formatGHS(b.base_price)}</td>
                        <td className="px-4 py-3.5 text-muted-foreground font-mono">{formatGHS(b.parentPrice)}</td>
                        <td className="px-4 py-3.5">
                          <div className="relative w-28">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">GH₵</span>
                            <Input
                              type="number"
                              step="0.1"
                              min={b.base_price}
                              placeholder={b.base_price.toFixed(2)}
                              value={overrideForm[b.id] ?? ""}
                              onChange={e => setOverrideForm(p => ({ ...p, [b.id]: e.target.value }))}
                              className="h-8 pl-10 text-xs rounded-lg font-mono w-full"
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" className="h-10 rounded-xl" onClick={() => setSelectedSubAgent(null)}>
                  Cancel
                </Button>
                <Button 
                  disabled={savingOverrides} 
                  onClick={saveOverrides}
                  className="h-10 px-6 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90"
                >
                  {savingOverrides ? "Saving..." : "Save Wholesale Rates"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
