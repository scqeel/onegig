import { useQuery } from "@tanstack/react-query";
import { Award, Loader2, Trophy, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function AgentLeaderboardTab({ agentProfile }: { agentProfile: any }) {
  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ["agent-leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_agent_leaderboard");
      if (error) throw error;
      return data;
    },
  });

  const getTier = (salesCount: number) => {
    if (salesCount >= 1000) return { name: "Elite Reseller", nextTier: "Ultimate Champion", min: 1000, max: 9999, color: "text-rose-500 dark:text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", glow: "shadow-rose-500/10", badge: "👑 Elite" };
    if (salesCount >= 200) return { name: "Platinum Reseller", nextTier: "Elite Reseller", min: 200, max: 1000, color: "text-cyan-500 dark:text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", glow: "shadow-cyan-500/10", badge: "💎 Platinum" };
    if (salesCount >= 50) return { name: "Gold Reseller", nextTier: "Platinum Reseller", min: 50, max: 200, color: "text-yellow-500 dark:text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", glow: "shadow-yellow-500/10", badge: "🏆 Gold" };
    if (salesCount >= 10) return { name: "Silver Reseller", nextTier: "Gold Reseller", min: 10, max: 50, color: "text-slate-400 dark:text-slate-300", bg: "bg-slate-500/10", border: "border-slate-500/20", glow: "shadow-slate-500/10", badge: "⭐ Silver" };
    return { name: "Bronze Reseller", nextTier: "Silver Reseller", min: 0, max: 10, color: "text-amber-600 dark:text-amber-500", bg: "bg-amber-600/10", border: "border-amber-600/20", glow: "shadow-amber-600/10", badge: "🥉 Bronze" };
  };

  const myStats = (leaderboard ?? []).find((x) => x.id === agentProfile.id) || { count: 0, volume: 0 };
  const myRankIndex = (leaderboard ?? []).findIndex((x) => x.id === agentProfile.id);
  const myRank = myRankIndex !== -1 ? myRankIndex + 1 : "—";
  const tier = getTier(myStats.count);
  const progress = Math.min(100, Math.round(((myStats.count - tier.min) / (tier.max - tier.min)) * 100));

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ── Dashboard Hero Banner with rich gold gamification gradient ── */}
      <div className="relative overflow-hidden rounded-[2rem] border border-amber-500/20 bg-gradient-to-br from-amber-500/15 via-yellow-500/5 to-transparent p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,transparent,transparent 22px,currentColor 22px,currentColor 23px)," +
              "repeating-linear-gradient(90deg,transparent,transparent 22px,currentColor 22px,currentColor 23px)",
          }}
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-xl bg-amber-500/15 px-3.5 py-1 text-amber-600 dark:text-amber-500">
              <Trophy className="h-4 w-4 fill-amber-500/20" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Reseller Championship</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Agent Leaderboard</h2>
            <p className="max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Compete with other reselling agents, boost your sales volume, rank up your reseller tier, and unlock high-tier VIP cashback rewards!
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4 bg-background/40 backdrop-blur-md border border-border/50 rounded-2xl p-4 shadow-soft">
            <div className="text-center px-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Your Rank</p>
              <p className="text-2xl font-bold text-amber-500 tabular-nums">#{myRank}</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center px-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Reseller Tier</p>
              <p className={cn("text-sm font-bold uppercase", tier.color)}>{tier.name}</p>
            </div>
          </div>
        </div>
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-24 h-20 w-20 rounded-full bg-yellow-500/5 blur-2xl" />
      </div>

      {/* ── Gamified Tier Progress Card ── */}
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Reseller Badge Leveling</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              You have completed <span className="font-bold text-foreground">{myStats.count} sales</span> (GH₵{myStats.volume.toFixed(2)} volume). You are currently a <span className={cn("font-bold", tier.color)}>{tier.name}</span>.
            </p>
          </div>
          <div className="w-full md:w-72 space-y-2">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <span>{tier.name}</span>
              <span>{progress}%</span>
              <span>{tier.nextTier}</span>
            </div>
            <div className="h-3 w-full bg-secondary/50 rounded-full overflow-hidden border border-border/40 p-0.5">
              <div 
                className="h-full rounded-full transition-all duration-1000 bg-primary relative shadow-glow"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>
            <p className="text-[10px] text-right text-muted-foreground/80 font-medium">
              {tier.max - myStats.count} more sales to reach {tier.nextTier}!
            </p>
          </div>
        </div>
      </div>

      {/* ── Leaderboard Table + Challenge Grid ── */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft lg:col-span-2">
          <div className="border-b border-border/60 bg-secondary/30 px-5 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Top Performing Resellers</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Ranked by complete Reseller Sales Volume (delivered orders)</p>
            </div>
            <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> Live Stats
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-bold uppercase tracking-widest text-center w-16">Rank</th>
                    <th className="px-5 py-3 font-bold uppercase tracking-widest">Reseller Store</th>
                    <th className="px-5 py-3 font-bold uppercase tracking-widest text-center">Sales</th>
                    <th className="px-5 py-3 font-bold uppercase tracking-widest text-right">Volume</th>
                    <th className="px-5 py-3 font-bold uppercase tracking-widest text-center">Badge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {leaderboard?.map((agent: any, idx: number) => {
                    const rank = idx + 1;
                    const isMe = agent.id === agentProfile.id;
                    const agentTier = getTier(agent.count);
                    
                    return (
                      <tr 
                        key={agent.id} 
                        className={cn(
                          "transition-colors hover:bg-secondary/20",
                          isMe ? "bg-primary/5 hover:bg-primary/10 border-l-4 border-l-primary" : ""
                        )}
                      >
                        <td className="px-5 py-3.5 text-center font-bold tabular-nums">
                          {rank === 1 ? "👑 1" : rank === 2 ? "🥈 2" : rank === 3 ? "🥉 3" : `#${rank}`}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-foreground">
                            {agent.store_name}{" "}
                            {isMe && (
                              <span className="ml-1.5 rounded bg-primary/15 px-1.5 py-0.5 text-[8px] font-bold uppercase text-primary tracking-wide">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">/store/{agent.store_slug}</p>
                        </td>
                        <td className="px-5 py-3.5 text-center font-bold tabular-nums text-muted-foreground">
                          {agent.count}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold tabular-nums text-foreground">
                          GH₵{agent.volume.toFixed(2)}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={cn("inline-block rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider", agentTier.bg, agentTier.color, agentTier.border)}>
                            {agentTier.badge}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-3xl border border-border/60 bg-card p-5 shadow-soft relative">
            <div className="absolute right-0 top-0 w-24 h-24 rounded-full bg-violet-500/10 blur-xl pointer-events-none" />
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4.5 w-4.5 text-violet-500" />
              <h4 className="font-bold text-foreground text-sm">Active Weekly Reseller Booster</h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Complete at least <span className="font-bold text-foreground">30 delivered sales</span> this week to unlock an extra <span className="font-bold text-green-500">GH₵50 cash boost</span> directly into your reseller wallet!
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                <span>Progress: {myStats.count} / 30</span>
                <span>{Math.min(100, Math.round((myStats.count / 30) * 100))}%</span>
              </div>
              <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden border border-border/40">
                <div 
                  className="h-full rounded-full transition-all duration-1000 bg-violet-500"
                  style={{ width: `${Math.min(100, Math.round((myStats.count / 30) * 100))}%` }}
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-[10px] font-semibold text-muted-foreground border-t border-border/40 pt-3">
              <span>Time remaining: 3 days</span>
              <span className="text-green-500 font-bold uppercase tracking-wider">GH₵50 Reward</span>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-border/60 bg-card p-5 shadow-soft relative">
            <div className="absolute right-0 top-0 w-24 h-24 rounded-full bg-amber-500/10 blur-xl pointer-events-none" />
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4.5 w-4.5 text-amber-500" />
              <h4 className="font-bold text-foreground text-sm">Monthly Volume Champion</h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The agent who achieves the highest reseller volume (GHS) at the end of the month will be crowned the **Volume Champion** and receive a <span className="font-bold text-green-500">GH₵500 mega cash prize!</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
