import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { formatGHS } from "@/lib/format";
import { ShoppingCart, ExternalLink, Calendar, Search, Smartphone, Loader2, LogOut, History, BriefcaseBusiness, ArrowRight, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardCustomerPage() {
  const { session } = useAuth();
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  const copyReceipt = (o: any) => {
    const text = `OneGig Data Receipt
-------------------
Reference: ${o.tx_ref}
Network: ${o.network?.name}
Bundle: ${o.bundle?.size_label}
Recipient: ${o.recipient_phone}
Date: ${new Date(o.created_at).toLocaleString()}
Price: ${formatGHS(o.sell_price)}
Status: ${o.status.toUpperCase()}`;
    navigator.clipboard.writeText(text);
    setCopiedRef(o.tx_ref);
    setTimeout(() => setCopiedRef(null), 2000);
  };
  
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const sidebarItems = [
    { label: "My Orders", icon: <History className="h-5 w-5" />, active: true, to: "/dashboard/customer" },
    { label: "Become an Agent", icon: <BriefcaseBusiness className="h-5 w-5" />, to: "/dashboard/agent" },
    { label: "Sign Out", icon: <LogOut className="h-5 w-5" />, onClick: handleSignOut },
  ];

  const recentNumbers = Array.from(new Set(orders?.map(o => o.recipient_phone))).filter(Boolean).slice(0, 5);

  return (
    <DashboardLayout
      title="My Account"
      subtitle="Track your data purchases and purchase history."
      badge="Customer"
      sidebarItems={sidebarItems}
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

        {recentNumbers.length > 0 && (
          <div className="mb-6 rounded-[2rem] border border-border/40 bg-card p-6 shadow-soft">
            <h3 className="text-sm font-semibold text-muted-foreground mb-4">Quick Top-Up Numbers</h3>
            <div className="flex flex-wrap gap-3">
              {recentNumbers.map(phone => (
                <Button key={phone as string} variant="secondary" asChild className="rounded-xl h-10 px-4">
                  <Link to={`/buy`}><Smartphone className="mr-2 h-4 w-4 text-primary" /> {phone as string}</Link>
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-6 relative overflow-hidden rounded-[2rem] bg-[#080c1a] p-6 sm:p-8 shadow-float">
          <div className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-md">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-primary">
                <BriefcaseBusiness className="h-3.5 w-3.5" /> Agent Program
              </div>
              <h3 className="text-xl font-bold text-white">Start your own data business</h3>
              <p className="mt-1 text-sm text-white/50 leading-relaxed">
                Upgrade to an agent account to get wholesale prices, a branded storefront, and keep 100% of your profits.
              </p>
            </div>
            <Button asChild className="shrink-0 h-12 rounded-xl gradient-primary font-bold shadow-float">
              <Link to="/dashboard/agent">Apply Now <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
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
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => copyReceipt(o)}
                          className="h-8 rounded-lg text-xs font-semibold"
                        >
                          {copiedRef === o.tx_ref ? <Check className="mr-1 h-3 w-3 text-emerald-500" /> : <Copy className="mr-1 h-3 w-3" />}
                          {copiedRef === o.tx_ref ? "Copied" : "Copy"}
                        </Button>
                        <Button asChild variant="ghost" size="sm" className="h-8 rounded-lg text-xs font-semibold">
                          <Link to={`/track?ref=${o.tx_ref}`}>Details <ExternalLink className="ml-1.5 h-3 w-3" /></Link>
                        </Button>
                      </div>
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
