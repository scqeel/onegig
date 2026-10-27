import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Award, ChevronDown, ChevronRight, DollarSign, ExternalLink, 
  GitBranch, Search, ShieldCheck, Store, TrendingUp, UserCheck, 
  Users, Zap 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatGHS, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

interface AgentProfile {
  id: string;
  user_id: string;
  business_name: string;
  slug: string;
  phone: string;
  parent_agent_id: string | null;
  agent_tier: string | null;
  created_at: string;
  profile?: {
    full_name: string;
    email: string;
  };
}

export function AdminAgentTreeTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

  const toggleParent = (parentId: string) => {
    setExpandedParents(prev => ({ ...prev, [parentId]: !prev[parentId] }));
  };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-agent-tree"],
    queryFn: async () => {
      // 1. Fetch all agent profiles
      const { data: agents, error } = await supabase
        .from("agent_profiles")
        .select(`
          id, user_id, business_name, slug, phone, parent_agent_id, 
          agent_tier, created_at
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const agentList: AgentProfile[] = agents || [];

      // 2. Fetch profiles for user names
      const userIds = [...new Set(agentList.map(a => a.user_id).filter(Boolean))];
      let userMap: Record<string, { full_name: string; email: string }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        (profiles || []).forEach(p => {
          userMap[p.id] = { full_name: p.full_name, email: p.email };
        });
      }

      // 3. Fetch sales metrics per agent
      const { data: orders } = await supabase
        .from("orders")
        .select("agent_id, sell_price, agent_profit, parent_agent_profit, status, payment_status")
        .in("status", ["delivered", "processing"]);

      const salesByAgent: Record<string, { gmv: number; profit: number; overrides: number; orders: number }> = {};
      (orders || []).forEach((o: any) => {
        if (o.agent_id) {
          if (!salesByAgent[o.agent_id]) salesByAgent[o.agent_id] = { gmv: 0, profit: 0, overrides: 0, orders: 0 };
          salesByAgent[o.agent_id].gmv += Number(o.sell_price || 0);
          salesByAgent[o.agent_id].profit += Number(o.agent_profit || 0);
          salesByAgent[o.agent_id].overrides += Number(o.parent_agent_profit || 0);
          salesByAgent[o.agent_id].orders += 1;
        }
      });

      // 4. Organize into parent agents and their nested sub-agents
      const enrichedAgents = agentList.map(a => ({
        ...a,
        profile: userMap[a.user_id],
        metrics: salesByAgent[a.id] || { gmv: 0, profit: 0, overrides: 0, orders: 0 },
      }));

      const topLevelAgents = enrichedAgents.filter(a => !a.parent_agent_id);
      const subAgents = enrichedAgents.filter(a => !!a.parent_agent_id);

      const tree = topLevelAgents.map(parent => ({
        ...parent,
        subAgents: subAgents.filter(sub => sub.parent_agent_id === parent.id),
      }));

      // Orphan sub-agents (whose parent was deleted or not top-level)
      const orphanSubAgents = subAgents.filter(sub => !topLevelAgents.some(p => p.id === sub.parent_agent_id));

      return {
        tree,
        orphanSubAgents,
        totalAgents: agentList.length,
        totalMasters: topLevelAgents.length,
        totalSubAgents: subAgents.length,
      };
    },
  });

  const handleUpdateTier = async (agentId: string, newTier: string) => {
    try {
      const { error } = await supabase
        .from("agent_profiles")
        .update({ agent_tier: newTier })
        .eq("id", agentId);

      if (error) throw error;
      toast({ title: "Agent Tier Updated", description: `Tier changed to ${newTier.toUpperCase()}` });
      qc.invalidateQueries({ queryKey: ["admin-agent-tree"] });
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    }
  };

  const filteredTree = (data?.tree || []).filter(item => {
    if (!search) return true;
    const term = search.toLowerCase();
    const matchesParent = 
      item.business_name?.toLowerCase().includes(term) ||
      item.slug?.toLowerCase().includes(term) ||
      item.phone?.toLowerCase().includes(term) ||
      item.profile?.full_name?.toLowerCase().includes(term);

    const matchesChild = item.subAgents.some(sub => 
      sub.business_name?.toLowerCase().includes(term) ||
      sub.slug?.toLowerCase().includes(term) ||
      sub.phone?.toLowerCase().includes(term) ||
      sub.profile?.full_name?.toLowerCase().includes(term)
    );

    return matchesParent || matchesChild;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Overview Metric Banners */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-soft">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Agent Force</span>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">{data?.totalAgents ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">Registered merchant retailers</p>
        </div>

        <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-soft">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Master Storefronts</span>
          <p className="mt-2 text-2xl font-bold tracking-tight text-primary tabular-nums">{data?.totalMasters ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">Independent top-level merchants</p>
        </div>

        <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-soft">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Downline Sub-Agents</span>
          <p className="mt-2 text-2xl font-bold tracking-tight text-indigo-400 tabular-nums">{data?.totalSubAgents ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">Recruited under master mentors</p>
        </div>

        <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-soft">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sub-Agent Network Depth</span>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-400 tabular-nums">
            {data?.totalMasters ? ((data.totalSubAgents / data.totalMasters).toFixed(1)) : "0.0"}x
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Avg sub-agents per master</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            type="text"
            placeholder="Search by agent name, store slug, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 rounded-xl bg-background pl-9 text-xs font-semibold"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Showing {filteredTree.length} master agent hierarchies
        </p>
      </div>

      {/* Tree Visualization Card */}
      <div className="overflow-hidden rounded-2xl border border-border/40 bg-card shadow-soft">
        <div className="border-b border-border/40 bg-card/50 p-6">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-base text-foreground">Agent Hierarchy & Downline Performance</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Expand any master agent to view their recruited sub-agents, wholesale overrides, and team sales volume.
          </p>
        </div>

        <div className="divide-y divide-border/40">
          {filteredTree.map((master) => {
            const isExpanded = !!expandedParents[master.id];
            const hasSubAgents = master.subAgents.length > 0;

            return (
              <div key={master.id} className="transition-colors hover:bg-accent/40">
                {/* Master Agent Row */}
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleParent(master.id)}
                      disabled={!hasSubAgents}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 transition-all",
                        hasSubAgents ? "hover:bg-secondary cursor-pointer text-foreground" : "opacity-30 cursor-default"
                      )}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
                      <Store className="h-5 w-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{master.business_name || "Unnamed Store"}</span>
                        <a
                          href={`/agents/dashboard?store=${master.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-mono text-primary hover:underline"
                        >
                          /{master.slug}
                          <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                        </a>
                        <span className="rounded-md bg-secondary/80 border border-border/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                          {master.agent_tier || "Standard"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {master.profile?.full_name || master.phone} · Joined {timeAgo(master.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Financial Metrics & Downline Counter */}
                  <div className="flex flex-wrap items-center gap-6 text-xs">
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block">Store GMV</span>
                      <span className="font-bold text-foreground tabular-nums">{formatGHS(master.metrics.gmv)}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block">Direct Profit</span>
                      <span className="font-bold text-emerald-500 tabular-nums">{formatGHS(master.metrics.profit)}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block">Downline Bonus</span>
                      <span className="font-bold text-indigo-400 tabular-nums">{formatGHS(master.metrics.overrides)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-bold text-indigo-400">
                        {master.subAgents.length} Sub-Agents
                      </span>

                      <select
                        value={master.agent_tier || "standard"}
                        onChange={(e) => handleUpdateTier(master.id, e.target.value)}
                        className="h-8 rounded-lg border border-border bg-background px-2 text-[11px] font-bold text-foreground outline-none cursor-pointer"
                      >
                        <option value="standard">Standard Tier</option>
                        <option value="silver">Silver Merchant</option>
                        <option value="gold">Gold Elite</option>
                        <option value="platinum">Platinum VIP</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Sub-Agent Nested Downlines */}
                {isExpanded && hasSubAgents && (
                  <div className="bg-secondary/20 border-t border-border/40 p-4 pl-14 space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                      Recruited Downline Sub-Agents ({master.subAgents.length})
                    </span>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {master.subAgents.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 p-3 shadow-sm"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                              <GitBranch className="h-4 w-4" />
                            </div>
                            <div>
                              <span className="font-semibold text-xs text-foreground block">{sub.business_name}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">/{sub.slug} · {sub.phone}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[11px] font-bold text-foreground block tabular-nums">{formatGHS(sub.metrics.gmv)}</span>
                            <span className="text-[9px] text-emerald-500 font-semibold">{sub.metrics.orders} sales</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
