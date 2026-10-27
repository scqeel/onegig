import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Activity, AlertTriangle, CheckCircle2, Clock, Code, 
  ExternalLink, Filter, RefreshCw, Search, Shield, 
  Terminal, Webhook, XCircle 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatGHS, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AdminAuditLogsTab() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedPayload, setSelectedPayload] = useState<any | null>(null);

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: async () => {
      // Pull recent wallet transactions and order status transitions as audit stream
      const [txRes, ordersRes] = await Promise.all([
        supabase
          .from("wallet_transactions")
          .select("id, user_id, type, amount, status, description, created_at")
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("orders")
          .select("id, reference, status, sell_price, recipient_phone, notes, updated_at, created_at, network:networks(name)")
          .order("updated_at", { ascending: false })
          .limit(40),
      ]);

      const events: any[] = [];

      (txRes.data || []).forEach((tx) => {
        events.push({
          id: tx.id,
          source: "ledger",
          event: `Wallet ${tx.type.toUpperCase()}`,
          status: tx.status === "completed" ? "success" : "pending",
          details: tx.description || `${tx.type} of GHS ${tx.amount}`,
          amount: tx.amount,
          timestamp: tx.created_at,
          payload: tx,
        });
      });

      (ordersRes.data || []).forEach((ord) => {
        events.push({
          id: ord.id,
          source: "fulfillment",
          event: `Order Ref: ${ord.reference || ord.id.slice(0, 8)}`,
          status: ord.status === "delivered" ? "success" : ord.status === "failed" ? "error" : "processing",
          details: `${ord.network?.name || "Network"} · ${ord.recipient_phone} · ${ord.notes || ord.status}`,
          amount: ord.sell_price,
          timestamp: ord.updated_at || ord.created_at,
          payload: ord,
        });
      });

      // Sort combined chronologically
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return events;
    },
    refetchInterval: 15000,
  });

  const filteredLogs = (logs || []).filter((log) => {
    if (filterType !== "all" && log.source !== filterType) return false;
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      log.event.toLowerCase().includes(term) ||
      log.details.toLowerCase().includes(term) ||
      log.id.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-border/40 bg-card p-6 shadow-soft">
        <div>
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight text-foreground">System Audit & Webhook Stream</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time telemetry stream of incoming webhook events, financial ledger transitions, and provider status syncs.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            className="rounded-xl h-9 gap-2 border-border/60 text-xs font-bold"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            Live Stream (15s)
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            type="text"
            placeholder="Search event, reference, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 rounded-xl bg-background pl-9 text-xs font-semibold"
          />
        </div>

        <div className="flex items-center gap-2">
          {["all", "fulfillment", "ledger"].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-bold capitalize transition-all",
                filterType === type
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground"
              )}
            >
              {type === "all" ? "All Events" : type === "fulfillment" ? "Orders & Gateways" : "Ledger & Wallets"}
            </button>
          ))}
        </div>
      </div>

      {/* Main Audit Feed Table */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-border/40 bg-card shadow-soft lg:col-span-2">
          <div className="border-b border-border/40 bg-card/50 p-4 flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Real-Time Event Stream</span>
            <span className="text-[11px] font-mono text-muted-foreground">{filteredLogs.length} events logged</span>
          </div>

          <div className="divide-y divide-border/40 max-h-[600px] overflow-y-auto">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                onClick={() => setSelectedPayload(log.payload)}
                className="flex items-center justify-between p-4 transition-colors hover:bg-accent/40 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs",
                    log.status === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" :
                    log.status === "error" ? "border-rose-500/30 bg-rose-500/10 text-rose-500" :
                    "border-sky-500/30 bg-sky-500/10 text-sky-400"
                  )}>
                    {log.status === "success" ? <CheckCircle2 className="h-4 w-4" /> :
                     log.status === "error" ? <XCircle className="h-4 w-4" /> :
                     <Activity className="h-4 w-4 animate-pulse" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-foreground">{log.event}</span>
                      <span className="rounded-md bg-secondary/80 border border-border/40 px-1.5 py-0.5 text-[9px] font-mono uppercase text-muted-foreground">
                        {log.source}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-sm">
                      {log.details}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  {log.amount !== undefined && (
                    <span className="font-bold text-xs text-foreground block tabular-nums">
                      {formatGHS(log.amount)}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {timeAgo(log.timestamp)}
                  </span>
                </div>
              </div>
            ))}

            {filteredLogs.length === 0 && (
              <div className="p-12 text-center text-xs text-muted-foreground">
                No matching system events found.
              </div>
            )}
          </div>
        </div>

        {/* Payload Inspector Panel */}
        <div className="overflow-hidden rounded-2xl border border-border/40 bg-card p-5 shadow-soft space-y-3">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <Code className="h-4 w-4 text-primary" />
              <h3 className="font-bold text-xs text-foreground">Raw Payload Inspector</h3>
            </div>
            {selectedPayload && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedPayload(null)}
                className="h-7 px-2 text-[10px]"
              >
                Clear
              </Button>
            )}
          </div>

          {selectedPayload ? (
            <div className="space-y-3">
              <pre className="max-h-[500px] overflow-auto rounded-xl bg-background/90 p-3.5 text-[11px] font-mono text-foreground leading-relaxed border border-border/60">
                {JSON.stringify(selectedPayload, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center text-xs text-muted-foreground space-y-2">
              <Webhook className="h-8 w-8 opacity-20" />
              <p>Click any event in the live stream to inspect its raw JSON metadata and diagnostic headers.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
