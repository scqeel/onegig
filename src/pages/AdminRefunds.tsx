import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatGHS } from "@/lib/format";
import {
  RefreshCcw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  RotateCcw,
  Send,
  Loader2,
  DollarSign,
  ArrowLeft,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function AdminRefunds() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Fetch failed & refunded orders
  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-refund-orders"],
    queryFn: async () => {
      const { data: rawOrders, error } = await supabase
        .from("orders")
        .select("*, network:networks(name, logo_emoji), bundle:bundles(size_label)")
        .in("status", ["failed", "refunded", "refund_requested", "pending"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      const ordersList = rawOrders || [];

      const userIds = [...new Set(ordersList.map((o: any) => o.customer_user_id || o.agent_id).filter(Boolean))];
      let profiles: any[] = [];
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, email, phone, wallet_balance")
          .in("id", userIds);
        if (profs) profiles = profs;
      }

      const profMap = new Map(profiles.map((p) => [p.id, p]));
      return ordersList.map((o: any) => ({
        ...o,
        customer: profMap.get(o.customer_user_id || o.agent_id) || null,
      }));
    },
    refetchInterval: 10000,
  });

  const list = orders || [];
  const failedCount = list.filter((o) => o.status === "failed").length;
  const refundedCount = list.filter((o) => o.status === "refunded").length;
  const pendingCount = list.filter((o) => o.status === "refund_requested" || o.status === "pending").length;
  const totalRefundedAmt = list
    .filter((o) => o.status === "refunded")
    .reduce((sum, o) => sum + Number(o.sell_price || 0), 0);

  const q = search.trim().toLowerCase();
  const filtered = list.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (!q) return true;
    return (
      (o.id || "").toLowerCase().includes(q) ||
      (o.recipient_phone || "").includes(q) ||
      (o.customer?.phone || "").includes(q) ||
      (o.notes || "").toLowerCase().includes(q)
    );
  });

  // Handle 1-Click Wallet Refund
  const handleProcessRefund = async (order: any) => {
    if (!confirm(`Are you sure you want to refund GH₵${order.sell_price} for Order #${order.id.slice(0, 8)}?`)) return;

    setProcessingId(order.id);
    try {
      const refundTargetId = order.customer_user_id || order.agent_id;
      const refundAmount = Number(order.sell_price || 0);

      if (refundTargetId && refundAmount > 0) {
        // Fetch profile balance
        const { data: prof } = await supabase
          .from("profiles")
          .select("wallet_balance")
          .eq("id", refundTargetId)
          .single();

        if (prof) {
          const newBal = Number(prof.wallet_balance || 0) + refundAmount;
          await supabase.from("profiles").update({ wallet_balance: newBal }).eq("id", refundTargetId);
          await supabase.from("wallet_transactions").insert({
            user_id: refundTargetId,
            type: "credit",
            amount: refundAmount,
            description: `Admin Manual Refund for Order #${order.id.slice(0, 8)}`,
            balance_after: newBal,
          });
        }
      }

      // Mark order as refunded
      await supabase
        .from("orders")
        .update({
          status: "refunded",
          notes: `${order.notes || ""} | Admin manual refund processed`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      toast({
        title: "Refund Issued Successfully! 💸",
        description: `GH₵${order.sell_price} credited to recipient wallet.`,
      });

      qc.invalidateQueries({ queryKey: ["admin-refund-orders"] });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Refund Failed",
        description: err.message || "Could not process refund",
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Retry Dispatch via DataHub
  const handleRetryDispatch = async (order: any) => {
    setProcessingId(order.id);
    try {
      const { data, error } = await supabase.functions.invoke("place-order", {
        body: {
          recipient: order.recipient_phone,
          network_code: order.network?.code || "MTN",
          size_label: order.bundle?.size_label || "1GB",
          request_id: order.id,
        },
      });

      if (error || !data?.ok) {
        throw new Error(data?.error || error?.message || "Dispatch retry failed");
      }

      await supabase
        .from("orders")
        .update({
          status: "processing",
          notes: `${order.notes || ""} | Retried dispatch via Admin`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      toast({
        title: "Order Re-Dispatched ⚡",
        description: `Order #${order.id.slice(0, 8)} resent to provider.`,
      });

      qc.invalidateQueries({ queryKey: ["admin-refund-orders"] });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Retry Failed",
        description: err.message || "Failed to re-dispatch order",
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link to="/admin" className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Admin
            </Link>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <RotateCcw className="h-6 w-6 text-purple-400" /> Refund & Delivery Control Center
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage failed orders, issue automated wallet refunds, and retry provider dispatches.
          </p>
        </div>

        <Button
          onClick={() => qc.invalidateQueries({ queryKey: ["admin-refund-orders"] })}
          variant="outline"
          className="border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-xs font-semibold"
        >
          <RefreshCcw className="h-3.5 w-3.5 mr-1.5" /> Refresh Queue
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-rose-400">Failed Orders</p>
          <p className="text-2xl font-black text-white">{failedCount}</p>
        </div>
        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-purple-400">Refunded Orders</p>
          <p className="text-2xl font-black text-white">{refundedCount}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">Pending Requests</p>
          <p className="text-2xl font-black text-white">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Total Refunded Value</p>
          <p className="text-2xl font-black text-emerald-400">{formatGHS(totalRefundedAmt)}</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search Order ID, Phone, Notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 rounded-xl bg-slate-950 border border-slate-800 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto w-full md:w-auto">
          {["all", "failed", "refund_requested", "refunded"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                statusFilter === st
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-500/25"
                  : "bg-slate-800/60 text-slate-400 hover:text-white"
              }`}
            >
              {st.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex justify-center items-center">
            <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <ShieldAlert className="h-8 w-8 mx-auto text-slate-600" />
            <p className="text-sm font-semibold">No refund orders matched your query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Order Info</th>
                  <th className="p-3.5">Recipient & Customer</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3.5">
                      <div className="font-mono text-purple-400 font-bold">#{o.id.slice(0, 8)}</div>
                      <div className="text-[10px] text-slate-500">{new Date(o.created_at).toLocaleString()}</div>
                      <div className="text-[11px] font-semibold text-slate-300 mt-1">
                        {o.network?.logo_emoji} {o.bundle?.size_label || "Data Bundle"}
                      </div>
                    </td>

                    <td className="p-3.5">
                      <div className="font-bold text-white">{o.recipient_phone}</div>
                      <div className="text-[10px] text-slate-400">
                        {o.customer?.full_name || o.customer?.phone || "Guest Customer"}
                      </div>
                      {o.notes && <div className="text-[10px] text-rose-400 truncate max-w-xs mt-0.5">{o.notes}</div>}
                    </td>

                    <td className="p-3.5 font-bold text-white tabular-nums">
                      {formatGHS(o.sell_price || 0)}
                    </td>

                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          o.status === "refunded"
                            ? "bg-purple-500/10 text-purple-400 border border-purple-500/30"
                            : o.status === "failed"
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                        }`}
                      >
                        {o.status === "refunded" && <CheckCircle2 className="h-3 w-3" />}
                        {o.status === "failed" && <XCircle className="h-3 w-3" />}
                        {o.status}
                      </span>
                    </td>

                    <td className="p-3.5 text-right space-x-2">
                      {o.status !== "refunded" && (
                        <Button
                          size="sm"
                          onClick={() => handleProcessRefund(o)}
                          disabled={processingId === o.id}
                          className="h-8 bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold rounded-lg"
                        >
                          {processingId === o.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <DollarSign className="h-3 w-3 mr-1" />} Issue Refund
                        </Button>
                      )}

                      {o.status !== "delivered" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRetryDispatch(o)}
                          disabled={processingId === o.id}
                          className="h-8 border-slate-700 bg-slate-800 text-slate-300 hover:text-white text-[11px] font-semibold rounded-lg"
                        >
                          <Send className="h-3 w-3 mr-1" /> Retry Dispatch
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
