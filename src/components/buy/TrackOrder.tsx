import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search } from "lucide-react";
import { TrackOrderCard } from "@/components/buy/TrackOrderCard";
import { useSettings } from "@/hooks/useSettings";
import { getOrderProgress } from "@/lib/orderProgress";

interface OrderResult {
  id: string;
  reference: string;
  payment_reference: string | null;
  recipient_phone: string;
  status: string;
  sell_price: number;
  created_at: string;
  notes?: string | null;
  bundle: { size_label: string } | null;
  network: { name: string; logo_emoji: string } | null;
}

export function TrackOrder() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("ref") ?? "");
  const [orders, setOrders] = useState<OrderResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const { data: settings } = useSettings();
  const whatsapp = String(settings?.whatsapp_group_link ?? "").trim();
  const supportPhone = String(settings?.support_phone ?? "").replace(/\D/g, "");
  const supportHref = whatsapp || (supportPhone ? `https://wa.me/${supportPhone}` : "");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [syncingRef, setSyncingRef] = useState<string | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Fetch orders via RPC ──────────────────────────────────────────────────
  const fetchOrders = useCallback(async (q: string) => {
    const raw = q.trim();
    if (!raw) {
      setOrders(null);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc("track_order", { search_query: raw });

      if (error) {
        console.error("Order tracking failed:", error.message);
        setOrders([]);
        setLoading(false);
        return;
      }

      let mapped: OrderResult[] = (data ?? []).map((o: any) => ({
        id: o.id,
        reference: o.reference,
        payment_reference: o.payment_reference,
        recipient_phone: o.recipient_phone,
        status: o.status,
        sell_price: Number(o.sell_price || 0),
        created_at: o.created_at,
        notes: o.notes,
        bundle: o.bundle_size_label ? { size_label: o.bundle_size_label } : null,
        network: o.network_name ? { name: o.network_name, logo_emoji: o.network_logo_emoji } : null,
      }));

      if (mapped.length === 0) {
        const digits = raw.replace(/\D/g, "");
        let qBuilder = supabase
          .from("orders")
          .select("id, reference, payment_reference, recipient_phone, status, sell_price, created_at, notes, bundle:bundles(size_label), network:networks(name, logo_emoji)")
          .order("created_at", { ascending: false })
          .limit(20);

        if (digits.length >= 9) {
          qBuilder = qBuilder.like("recipient_phone", `%${digits.slice(-9)}`);
        } else {
          qBuilder = qBuilder.or(`reference.ilike.%${raw}%,payment_reference.ilike.%${raw}%,id.eq.${raw}`);
        }

        const { data: directOrders } = await qBuilder;
        if (directOrders && directOrders.length > 0) {
          mapped = directOrders.map((o: any) => ({
            id: o.id,
            reference: o.reference,
            payment_reference: o.payment_reference,
            recipient_phone: o.recipient_phone,
            status: o.status,
            sell_price: Number(o.sell_price || 0),
            created_at: o.created_at,
            notes: o.notes,
            bundle: o.bundle ? { size_label: (o.bundle as any).size_label } : null,
            network: o.network ? { name: (o.network as any).name, logo_emoji: (o.network as any).logo_emoji } : null,
          }));
        }
      }

      setOrders(mapped);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Tracking RPC error:", err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync with searchParams & Auto-Fetch
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      setQuery(ref);
      fetchOrders(ref);
    }
  }, [searchParams, fetchOrders]);

const SUPABASE_URL = "https://huvuogyvgeoqiqltbgcw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1dnVvZ3l2Z2VvcWlxbHRiZ2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MjY1MDYsImV4cCI6MjA5MTAwMjUwNn0.uysmVkP3O00NZaT4ucojUmJAHSA9HB6IUCl7wZCUvVQ";

async function checkOrderStatusNoLock(orderId: string) {
  return fetch(`${SUPABASE_URL}/functions/v1/admin-provider-action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ action: "check_order_status", order_id: orderId }),
  });
}

  // 4-Second Auto-Polling & 10-Second Live Provider Sync for active processing orders
  const processingOrderIds = orders
    ?.filter((o) => ["pending", "processing"].includes(o.status))
    .map((o) => o.id)
    .join(",");

  useEffect(() => {
    if (!query.trim() || !processingOrderIds) {
      return;
    }
    const ids = processingOrderIds.split(",");

    const interval = setInterval(() => {
      fetchOrders(query);
    }, 4000);

    const syncProviderStatus = async () => {
      for (const id of ids) {
        try {
          await checkOrderStatusNoLock(id);
        } catch (e) {
          console.warn("Live status sync error:", e);
        }
      }
    };

    syncProviderStatus();
    const syncInterval = setInterval(syncProviderStatus, 10000);

    return () => {
      clearInterval(interval);
      clearInterval(syncInterval);
    };
  }, [query, processingOrderIds, fetchOrders]);

  // Real-time Postgres Channel Listener
  useEffect(() => {
    if (!orders || !orders.length) return;

    const orderIds = orders.map((o) => o.id);
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const ch = supabase
      .channel(`track-orders-live-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=in.(${orderIds.join(",")})`,
        },
        (payload) => {
          setOrders((prev) =>
            prev
              ? prev.map((o) =>
                  o.id === payload.new.id
                    ? { ...o, status: payload.new.status, notes: payload.new.notes }
                    : o
                )
              : prev
          );
          setLastUpdated(new Date());
        }
      )
      .subscribe();

    channelRef.current = ch;

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [orders]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearchParams({ ref: query.trim() });
    fetchOrders(query.trim());
  };

  const anyActive = orders?.some((o) => getOrderProgress(o.status).isActive);

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearchSubmit} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <label htmlFor="track-query" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Phone number or order reference
        </label>
        <div className="mt-2 flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="track-query"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="0547xxxxxx or OG-xxxx"
              className="h-12 rounded-xl pl-10 text-base font-semibold"
            />
          </div>
          <Button type="submit" disabled={loading || !query.trim()} className="h-12 rounded-xl px-5 text-sm font-bold">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Track"}
          </Button>
        </div>
      </form>

      {anyActive && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2.5 text-xs shadow-soft">
          <span className="flex items-center gap-2 font-semibold text-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Updating automatically
          </span>
          {lastUpdated && <span className="tabular-nums text-muted-foreground">Updated {lastUpdated.toLocaleTimeString()}</span>}
        </div>
      )}

      {loading && !orders && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-12 text-sm text-muted-foreground shadow-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> Looking up your order...
        </div>
      )}

      {!loading && orders === null && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
          <p className="text-sm font-semibold text-foreground">Enter the number that received the data</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            You can also use the order reference from your confirmation screen.
          </p>
        </div>
      )}

      {!loading && orders !== null && orders.length === 0 && (
        <div className="space-y-3 rounded-2xl border border-dashed border-border bg-card p-6 text-center">
          <div>
            <h3 className="text-base font-semibold text-foreground">No matching orders found</h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
              We couldn't find an order matching <span className="font-mono font-semibold text-foreground">"{query}"</span>. Please check your phone number or reference code.
            </p>
          </div>
          <Button asChild size="sm" className="h-9 rounded-xl text-xs font-semibold">
            <Link to="/buy">Buy Data Now</Link>
          </Button>
        </div>
      )}

      {orders && orders.length > 0 && (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {orders.map((order) => (
            <TrackOrderCard
              key={order.id}
              order={order}
              supportHref={supportHref}
              syncing={syncingRef === order.id}
              onSync={async () => {
                setSyncingRef(order.id);
                try {
                  await checkOrderStatusNoLock(order.id);
                  await fetchOrders(query);
                } catch (e) {
                  console.warn("Sync status error:", e);
                } finally {
                  setSyncingRef(null);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
