import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { 
  History, 
  BriefcaseBusiness, 
  Gift, 
  User, 
  LogOut, 
  ShoppingCart, 
  Search, 
  Smartphone, 
  ArrowRight, 
  Loader2, 
  Calendar, 
  Check, 
  Copy, 
  ExternalLink 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { formatGHS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/ui/OrderStatusBadge";

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
    refetchInterval: 4000,
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
    { label: "Refer & Earn", icon: <Gift className="h-5 w-5" />, to: "/dashboard/referrals" },
    { label: "My Profile", icon: <User className="h-5 w-5" />, to: "/dashboard/profile" },
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
        <Button asChild className="rounded-xl">
          <Link to="/buy">Buy Data Now <ShoppingCart className="ml-2 h-4 w-4" /></Link>
        </Button>
      }
    >
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="text-sm font-semibold text-muted-foreground">Total Orders</h3>
            <p className="mt-2 text-3xl font-bold">{orders?.length ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 md:col-span-2 flex flex-col justify-center">
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
          <div className="mb-6 rounded-[1.75rem] border border-border bg-card p-6">
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

        <div className="mb-6 relative overflow-hidden rounded-[1.75rem] border border-border bg-card p-6 sm:p-8">
          <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-md">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <BriefcaseBusiness className="h-3.5 w-3.5" /> Agent Program
              </div>
              <h3 className="text-xl font-bold text-foreground">Start your own data business</h3>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Upgrade to an agent account to get wholesale prices, a branded storefront, and keep 100% of your profits.
              </p>
            </div>
            <Button asChild className="shrink-0 h-12 rounded-xl">
              <Link to="/dashboard/agent">Apply Now <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[1.75rem] border border-border bg-card">
          <div className="border-b border-border p-6">
            <h2 className="text-lg font-bold text-foreground">Order History</h2>
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
                <h3 className="text-lg font-bold text-foreground">No orders yet</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                  You haven't purchased any data bundles yet. Buy your first bundle to see it here!
                </p>
                <Button asChild className="mt-6 rounded-xl">
                  <Link to="/buy">Buy Data</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {orders.map((o: any) => (
                  <div key={o.id} className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between hover:bg-accent transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Smartphone className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground">{o.network?.name} {o.bundle?.size_label}</p>
                          <OrderStatusBadge status={o.status} size="sm" />
                          {o.payment_reference?.startsWith("WP-") && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary uppercase tracking-wider">
                              Wallet
                            </span>
                          )}
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
                      <p className="text-lg font-bold text-foreground">{formatGHS(Number(o.sell_price))}</p>
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
