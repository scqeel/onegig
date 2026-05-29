import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { formatGHS } from "@/lib/format";
import { ShoppingCart, ExternalLink, Calendar, Search, Smartphone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardCustomerPage() {
  const { session } = useAuth();
  
  const { data: orders, isLoading } = useQuery({
    queryKey: ["customer-orders", session?.user.id],
    enabled: !!session?.user.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, bundle:bundles(size_label), network:networks(name)")
        .eq("customer_user_id", session!.user.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  return (
    <DashboardLayout
      title="My Account"
      subtitle="Track your data purchases and purchase history."
      badge="Customer"
      topActions={
        <Button asChild className="rounded-xl gradient-primary font-bold shadow-float">
          <Link to="/buy">Buy Data Now <ShoppingCart className="ml-2 h-4 w-4" /></Link>
        </Button>
      }
    >
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-soft">
            <h3 className="text-sm font-semibold text-muted-foreground">Total Orders</h3>
            <p className="mt-2 text-3xl font-black">{orders?.length ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-soft md:col-span-2 flex flex-col justify-center">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">Quick Actions</h3>
            <div className="flex gap-3">
              <Button asChild variant="outline" className="rounded-xl">
                <Link to="/buy"><ShoppingCart className="mr-2 h-4 w-4" /> New Purchase</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link to="/track"><Search className="mr-2 h-4 w-4" /> Track specific order</Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card shadow-soft">
          <div className="border-b border-border/40 bg-card/50 p-6">
            <h2 className="text-lg font-bold">Order History</h2>
            <p className="text-sm text-muted-foreground">Your recent data purchases.</p>
          </div>
          
          <div className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-12 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading orders...
              </div>
            ) : !orders || orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ShoppingCart className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold">No orders yet</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                  You haven't purchased any data bundles yet. Buy your first bundle to see it here!
                </p>
                <Button asChild className="mt-6 rounded-xl">
                  <Link to="/buy">Buy Data</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {orders.map((o: any) => (
                  <div key={o.id} className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between hover:bg-accent/20 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
                        <Smartphone className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold">{o.network?.name} {o.bundle?.size_label}</p>
                          <StatusBadge status={o.status} />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{o.recipient_phone}</p>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(o.created_at).toLocaleDateString()}</span>
                          <span>•</span>
                          <span className="font-mono">{o.tx_ref}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:flex-col sm:items-end sm:gap-2">
                      <p className="text-lg font-black">{formatGHS(Number(o.sell_price))}</p>
                      <Button asChild variant="ghost" size="sm" className="h-8 rounded-lg text-xs font-semibold">
                        <Link to={`/track?ref=${o.tx_ref}`}>View Details <ExternalLink className="ml-1.5 h-3 w-3" /></Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
      </div>
    </DashboardLayout>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; dot: string; label: string }> = {
    delivered:  { bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", dot: "bg-emerald-500", label: "Delivered"  },
    paid:       { bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", dot: "bg-emerald-500", label: "Paid"       },
    approved:   { bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", dot: "bg-emerald-500", label: "Approved"   },
    pending:    { bg: "bg-amber-500/10  text-amber-600  border-amber-500/20",  dot: "bg-amber-500",  label: "Pending"    },
    processing: { bg: "bg-sky-500/10   text-sky-600   border-sky-500/20",    dot: "bg-sky-500",    label: "Processing" },
    failed:     { bg: "bg-rose-500/10  text-rose-600  border-rose-500/20",   dot: "bg-rose-500",   label: "Failed"     },
    rejected:   { bg: "bg-rose-500/10  text-rose-600  border-rose-500/20",   dot: "bg-rose-500",   label: "Rejected"   },
  };
  const cfg = map[status] ?? { bg: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground", label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cfg.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
