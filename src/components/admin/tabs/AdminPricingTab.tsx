import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Cog, Loader2, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatGHS } from "@/lib/format";

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
  const [form, setForm]           = useState({ network_id: "", size_label: "", size_gb: "", user_price: "", base_price: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activationFee, setActivationFee] = useState("50");

  const { data: payload, isLoading } = useQuery({
    queryKey: ["admin-pricing"],
    queryFn: async () => {
      const [{ data: networks }, { data: bundles }, { data: feeRow }] = await Promise.all([
        supabase.from("networks").select("id, name, code").order("sort_order"),
        supabase.from("bundles").select("*").order("size_mb", { ascending: true }),
        supabase.from("app_settings").select("value").eq("key", "agent_activation_fee").maybeSingle(),
      ]);
      return { networks: networks ?? [], bundles: bundles ?? [], activationFee: Number(feeRow?.value ?? 50) };
    },
  });

  useEffect(() => {
    if (payload?.activationFee != null) setActivationFee(String(payload.activationFee));
  }, [payload?.activationFee]);

  const saveBundle = async () => {
    if (!form.network_id || !form.size_label || !form.size_gb || !form.base_price || !form.user_price) return;
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
      if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Package updated successfully" });
    } else {
      const { error } = await supabase.from("bundles").insert(row as any);
      if (error) { toast({ title: "Create failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "New package created" });
    }
    setForm({ network_id: "", size_label: "", size_gb: "", user_price: "", base_price: "" });
    setEditingId(null);
    qc.invalidateQueries({ queryKey: ["admin-pricing"] });
  };

  const removeBundle = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate this package?")) return;
    const { error } = await supabase.from("bundles").update({ active: false }).eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    await supabase.from("agent_bundle_prices").update({ active: false }).eq("bundle_id", id);
    toast({ title: "Package deactivated" });
    qc.invalidateQueries({ queryKey: ["admin-pricing"] });
  };

  const saveActivationFee = async () => {
    const { error } = await supabase.from("app_settings").upsert({ key: "agent_activation_fee", value: Number(activationFee) });
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Activation fee updated" });
  };

  if (isLoading) return <LoadingCard text="Syncing pricing configurations…" />;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="overflow-hidden rounded-[2rem] border border-border/45 bg-card shadow-soft">
        <div className="border-b border-border/40 bg-card/50 p-6">
          <h2 className="text-xl font-bold tracking-tight text-foreground">{editingId ? "Edit Package" : "Create New Package"}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Configure data bundle pricing and network availability.</p>
        </div>
        <div className="p-6 md:p-8">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="group relative border border-border/50 rounded-2xl p-4 bg-background/30 transition-all focus-within:ring-2 focus-within:ring-primary/20 hover:bg-background/40">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Network Provider</label>
              <select
                value={form.network_id}
                onChange={(e) => setForm((p) => ({ ...p, network_id: e.target.value }))}
                className="w-full appearance-none bg-transparent text-sm font-semibold text-foreground outline-none cursor-pointer"
              >
                <option value="">Select Network…</option>
                {payload?.networks.map((n: any) => <option key={n.id} value={n.id}>{n.name}</option>)}
              </select>
            </div>
            
            <div className="group relative border border-border/50 rounded-2xl p-4 bg-background/30 transition-all focus-within:ring-2 focus-within:ring-primary/20 hover:bg-background/40">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Bundle Label</label>
              <select 
                value={form.size_label} 
                onChange={(e) => {
                  const val = e.target.value;
                  let gb = form.size_gb;
                  if (val.includes("500MB")) gb = "0.5";
                  else if (val.includes("GB")) {
                    const match = val.match(/([\d.]+)GB/);
                    if (match) gb = match[1];
                  }
                  setForm((p) => ({ ...p, size_label: val, size_gb: gb }));
                }} 
                className="w-full appearance-none bg-transparent text-sm font-semibold text-foreground outline-none cursor-pointer" 
              >
                <option value="">Select Bundle Label…</option>
                <option value="500MB Non-Expiry">500MB Non-Expiry</option>
                <option value="1GB Non-Expiry">1GB Non-Expiry</option>
                <option value="1.5GB Non-Expiry">1.5GB Non-Expiry</option>
                <option value="2GB Non-Expiry">2GB Non-Expiry</option>
                <option value="3GB Non-Expiry">3GB Non-Expiry</option>
                <option value="4GB Non-Expiry">4GB Non-Expiry</option>
                <option value="5GB Non-Expiry">5GB Non-Expiry</option>
                <option value="6GB Non-Expiry">6GB Non-Expiry</option>
                <option value="7GB Non-Expiry">7GB Non-Expiry</option>
                <option value="8GB Non-Expiry">8GB Non-Expiry</option>
                <option value="9GB Non-Expiry">9GB Non-Expiry</option>
                <option value="10GB Non-Expiry">10GB Non-Expiry</option>
                <option value="15GB Non-Expiry">15GB Non-Expiry</option>
                <option value="20GB Non-Expiry">20GB Non-Expiry</option>
                <option value="25GB Non-Expiry">25GB Non-Expiry</option>
                <option value="30GB Non-Expiry">30GB Non-Expiry</option>
                <option value="40GB Non-Expiry">40GB Non-Expiry</option>
                <option value="50GB Non-Expiry">50GB Non-Expiry</option>
                <option value="100GB Non-Expiry">100GB Non-Expiry</option>
                <option value="200GB Non-Expiry">200GB Non-Expiry</option>
              </select>
            </div>
            
            <div className="group relative border border-border/50 rounded-2xl p-4 bg-background/30 transition-all focus-within:ring-2 focus-within:ring-primary/20 hover:bg-background/40">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Data Size (GB)</label>
              <select 
                value={form.size_gb} 
                onChange={(e) => setForm((p) => ({ ...p, size_gb: e.target.value }))} 
                className="w-full appearance-none bg-transparent text-sm font-semibold text-foreground outline-none cursor-pointer" 
              >
                <option value="">Select Data Size…</option>
                <option value="0.5">0.5 GB (500MB)</option>
                <option value="1">1.0 GB</option>
                <option value="1.5">1.5 GB</option>
                <option value="2">2.0 GB</option>
                <option value="3">3.0 GB</option>
                <option value="4">4.0 GB</option>
                <option value="5">5.0 GB</option>
                <option value="6">6.0 GB</option>
                <option value="7">7.0 GB</option>
                <option value="8">8.0 GB</option>
                <option value="9">9.0 GB</option>
                <option value="10">10.0 GB</option>
                <option value="15">15.0 GB</option>
                <option value="20">20.0 GB</option>
                <option value="25">25.0 GB</option>
                <option value="30">30.0 GB</option>
                <option value="40">40.0 GB</option>
                <option value="50">50.0 GB</option>
                <option value="100">100.0 GB</option>
                <option value="200">200.0 GB</option>
              </select>
            </div>
            
            <div className="group relative border border-border/50 rounded-2xl p-4 bg-background/30 transition-all focus-within:ring-2 focus-within:ring-primary/20 hover:bg-background/40">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Regular User Price (GHS)</label>
              <input 
                placeholder="e.g. 5.50" 
                type="number" 
                step="0.01" 
                value={form.user_price} 
                onChange={(e) => setForm((p) => ({ ...p, user_price: e.target.value }))} 
                className="w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/30" 
              />
            </div>
            
            <div className="group relative border border-primary/30 rounded-2xl p-4 bg-primary/5 transition-all focus-within:ring-2 focus-within:ring-primary/25 hover:bg-primary/10">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-primary">Agent Wholesale Price (GHS)</label>
              <input 
                placeholder="e.g. 4.50" 
                type="number" 
                step="0.01" 
                value={form.base_price} 
                onChange={(e) => setForm((p) => ({ ...p, base_price: e.target.value }))} 
                className="w-full bg-transparent text-sm font-semibold text-primary outline-none placeholder:text-primary/30" 
              />
            </div>
          </div>
          
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button className="h-11 w-full rounded-xl bg-primary font-bold shadow-soft transition-all hover:scale-[1.02] active:scale-[0.98] sm:w-auto sm:px-10 text-xs" onClick={saveBundle}>
              {editingId ? "Update Configuration" : "Add Package"}
            </Button>
            {editingId && (
              <Button variant="ghost" className="h-11 w-full rounded-xl font-bold sm:w-auto sm:px-8 text-xs hover:bg-secondary/40" onClick={() => { setEditingId(null); setForm({ network_id: "", size_label: "", size_gb: "", user_price: "", base_price: "" }); }}>
                Cancel Edit
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-[2rem] border border-border/45 bg-card shadow-soft">
          <div className="border-b border-border/40 bg-card/50 p-6">
            <h3 className="text-lg font-bold tracking-tight text-foreground">Active Inventory</h3>
            <p className="text-xs text-muted-foreground mt-0.5">All currently active data packages.</p>
          </div>
          <div className="max-h-[600px] space-y-4 overflow-y-auto p-5 no-scrollbar">
            {(payload?.networks ?? []).map((n: any) => {
              const items = (payload?.bundles ?? []).filter((b: any) => b.network_id === n.id && b.active);
              if (!items.length) return null;
              return (
                <div key={n.id} className="rounded-2xl border border-border/40 bg-background/20 p-4">
                  <h4 className="mb-3.5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/80">
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    {n.name}
                  </h4>
                  <div className="grid gap-2">
                    {items.map((b: any) => (
                      <div key={b.id} className="group flex items-center justify-between rounded-xl border border-border/40 bg-background/40 p-3 transition-colors hover:bg-secondary/20">
                        <div>
                          <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{b.size_label}</p>
                          <p className="text-[10px] font-semibold uppercase tracking-tight text-muted-foreground/95 mt-0.5">
                            User: <span className="text-foreground font-bold">{formatGHS(Number(b.user_price ?? b.base_price))}</span>{" "}
                            · Agent: <span className="font-bold text-primary">{formatGHS(Number(b.base_price))}</span>
                          </p>
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            variant="ghost" size="sm"
                            className="h-8 w-8 rounded-lg p-0 border border-border/30 hover:bg-primary hover:text-white transition-all"
                            onClick={() => { setEditingId(b.id); setForm({ network_id: b.network_id, size_label: b.size_label, size_gb: String(b.size_mb / 1000), user_price: String(b.user_price ?? b.base_price), base_price: String(b.base_price) }); }}
                          >
                            <Cog className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 rounded-lg p-0 text-destructive border border-border/30 hover:bg-destructive/10 hover:border-destructive/20 transition-all" onClick={() => removeBundle(b.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="overflow-hidden rounded-[2rem] border border-border/45 bg-card shadow-soft">
            <div className="border-b border-border/40 bg-card/50 p-6">
              <h3 className="text-lg font-bold tracking-tight text-foreground">Onboarding Settings</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Configure costs for new agent registrations.</p>
            </div>
            <div className="p-6 space-y-4">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Activation Fee (GHS)</label>
              <div className="flex gap-3">
                <Input value={activationFee} onChange={(e) => setActivationFee(e.target.value)} className="h-11 rounded-xl bg-background/50 font-bold text-sm text-foreground focus-visible:ring-2 focus-visible:ring-primary/20 border-border/60" />
                <Button className="h-11 rounded-xl bg-foreground px-6 font-bold text-background transition-all hover:opacity-90 active:scale-95 text-xs" onClick={saveActivationFee}>
                  Update Fee
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center rounded-[2rem] border border-dashed border-border/60 bg-accent/5 p-8 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/20 text-muted-foreground">
              <Settings className="h-6 w-6" />
            </div>
            <p className="px-6 text-sm font-medium text-muted-foreground">Additional pricing modules and promotional tools will appear here in future updates.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
