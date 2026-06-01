import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Users, Search, Plus, UserPlus, Trash2, Edit2, Loader2, Save, X, MessageCircle, Sparkles, AlertTriangle, Moon, Bell, Megaphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Customer {
  id: string;
  name: string;
  phone: string;
}

type CRMSegment = "all" | "vip" | "slipping" | "inactive";

export function CustomerCRM() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [activeSegment, setActiveSegment] = useState<CRMSegment>("all");

  // Notification Broadcast states
  const [alertOpen, setAlertOpen] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState("info");
  const [alertSound, setAlertSound] = useState("default");
  const [isSendingAlert, setIsSendingAlert] = useState(false);

  const handleSendAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertTitle.trim() || !alertMessage.trim() || !selectedPhone) return;

    setIsSendingAlert(true);
    try {
      const cleanPhone = selectedPhone.replace(/\D/g, "");
      
      // Look up profiles to check if user has a registered account matching this phone
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone", cleanPhone)
        .maybeSingle();

      if (!profileRow) {
        // Fallback to sending direct SMS
        const { error: smsError } = await supabase.functions.invoke("crm-manage", {
          body: { action: "send_sms", phone: cleanPhone, message: alertMessage }
        });

        if (smsError) {
          toast({
            title: "Failed to send SMS",
            description: smsError.message,
            variant: "destructive"
          });
        } else {
          toast({ 
            title: "SMS Sent Successfully!", 
            description: "This customer does not have the app, so we sent them a direct SMS instead!" 
          });
          setAlertTitle("");
          setAlertMessage("");
          setAlertOpen(false);
        }
        setIsSendingAlert(false);
        return;
      }

      // Insert notification
      const { error } = await supabase
        .from("app_notifications")
        .insert({
          title: alertTitle,
          message: alertMessage,
          type: alertType,
          sound_name: alertSound,
          target_user_id: profileRow.id,
          is_global: false
        });

      if (error) throw error;

      toast({ title: "Alert Sent Successfully!" });
      setAlertTitle("");
      setAlertMessage("");
      setAlertOpen(false);
    } catch (err: any) {
      toast({ 
        title: "Failed to send notification", 
        description: "Must have placed a storefront order to be eligible for in-app alerts.", 
        variant: "destructive" 
      });
    } finally {
      setIsSendingAlert(false);
    }
  };

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("crm-manage", {
        body: { action: "list" }
      });
      if (error) throw error;
      setCustomers(data?.customers || []);
    } catch (e: any) {
      toast({ title: "Failed to load customers", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Query order statistics for each customer to compute segmentation
  const { data: customerStats, refetch: refetchStats } = useQuery({
    queryKey: ["agent-crm-customer-stats"],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getUser();
      if (!sessionData?.user) return null;

      const { data: agentProfile } = await supabase
        .from("agent_profiles")
        .select("id, store_slug, store_name")
        .eq("user_id", sessionData.user.id)
        .maybeSingle();

      if (!agentProfile) return null;

      const { data: orders } = await supabase
        .from("orders")
        .select("recipient_phone, created_at, status")
        .eq("agent_id", agentProfile.id)
        .eq("status", "delivered");

      const stats: Record<string, { count: number; lastOrder: string }> = {};
      (orders ?? []).forEach((o: any) => {
        const phone = o.recipient_phone?.replace(/\D/g, "");
        if (!phone) return;
        
        const current = stats[phone] || { count: 0, lastOrder: "" };
        current.count += 1;
        if (!current.lastOrder || new Date(o.created_at) > new Date(current.lastOrder)) {
          current.lastOrder = o.created_at;
        }
        stats[phone] = current;
      });

      return { stats, agentProfile };
    }
  });

  const handleSave = async () => {
    if (!formName || formPhone.length < 9) {
      return toast({ title: "Please provide valid name and phone", variant: "destructive" });
    }
    setIsSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.functions.invoke("crm-manage", {
          body: { action: "update", id: editingId, name: formName, phone: formPhone }
        });
        if (error) throw error;
        toast({ title: "Customer updated!" });
      } else {
        const { error } = await supabase.functions.invoke("crm-manage", {
          body: { action: "add", name: formName, phone: formPhone }
        });
        if (error) throw error;
        toast({ title: "Customer added successfully!" });
      }
      setIsAdding(false);
      setEditingId(null);
      setFormName("");
      setFormPhone("");
      fetchCustomers();
      refetchStats();
    } catch (e: any) {
      toast({ title: "Operation failed", description: e.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this customer?")) return;
    try {
      const { error } = await supabase.functions.invoke("crm-manage", {
        body: { action: "delete", id }
      });
      if (error) throw error;
      toast({ title: "Customer deleted" });
      fetchCustomers();
      refetchStats();
    } catch (e: any) {
      toast({ title: "Failed to delete", description: e.message, variant: "destructive" });
    }
  };

  const getDaysSince = (dateStr: string) => {
    if (!dateStr) return 999; // Never ordered
    const diffTime = Math.abs(new Date().getTime() - new Date(dateStr).getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Helper to segment customers
  const segmentedCustomers = customers.map(c => {
    const cleanPhone = c.phone.replace(/\D/g, "");
    const stats = customerStats?.stats?.[cleanPhone];
    const orderCount = stats?.count || 0;
    const lastOrderDate = stats?.lastOrder || "";
    const daysSince = getDaysSince(lastOrderDate);

    let segment: CRMSegment = "all";
    if (orderCount >= 5) {
      segment = "vip";
    } else if (daysSince >= 7 && daysSince < 14) {
      segment = "slipping";
    } else if (daysSince >= 14) {
      segment = "inactive";
    }

    return {
      ...c,
      orderCount,
      lastOrderDate,
      daysSince,
      segment
    };
  });

  const filtered = segmentedCustomers
    .filter(c => {
      if (activeSegment !== "all") {
        return c.segment === activeSegment;
      }
      return true;
    })
    .filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase()) || 
      c.phone.includes(search)
    );

  const statsCount = {
    all: customers.length,
    vip: segmentedCustomers.filter(c => c.segment === "vip").length,
    slipping: segmentedCustomers.filter(c => c.segment === "slipping").length,
    inactive: segmentedCustomers.filter(c => c.segment === "inactive").length,
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center text-violet-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Customer Address Book (CRM)</h2>
            <p className="text-sm text-slate-500 font-medium">Segment contacts and trigger high-converting WhatsApp promos.</p>
          </div>
        </div>

        <Button 
          onClick={() => { setIsAdding(true); setEditingId(null); setFormName(""); setFormPhone(""); }} 
          className="h-11 px-6 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold"
        >
          <UserPlus className="mr-2 h-4 w-4" /> Add Customer
        </Button>
      </div>

      {/* Editor Form */}
      {(isAdding || editingId) && (
        <div className="bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-900/50 p-6 rounded-2xl shadow-sm ring-4 ring-violet-50 dark:ring-violet-500/5 animate-in slide-in-from-top-4">
          <h3 className="font-bold text-slate-800 dark:text-white mb-4">
            {editingId ? "Edit Customer" : "New Customer"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Full Name</label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="John Doe" className="h-11" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Phone Number</label>
              <Input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="024 XXX XXXX" className="h-11" />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => { setIsAdding(false); setEditingId(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-8">
              {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />} 
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}

      {/* CRM SEGMENTATION FILTER BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { id: "all", label: "All Contacts", count: statsCount.all, icon: Users, color: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800", activeColor: "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950" },
          { id: "vip", label: "🔥 VIP (5+ Orders)", count: statsCount.vip, icon: Sparkles, color: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20", activeColor: "bg-amber-500 text-white border-amber-500" },
          { id: "slipping", label: "⚠️ Slipping (7d+)", count: statsCount.slipping, icon: AlertTriangle, color: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20", activeColor: "bg-rose-500 text-white border-rose-500" },
          { id: "inactive", label: "💤 Inactive (14d+)", count: statsCount.inactive, icon: Moon, color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20", activeColor: "bg-blue-500 text-white border-blue-500" },
        ].map((seg) => {
          const Icon = seg.icon;
          const active = activeSegment === seg.id;
          return (
            <button
              key={seg.id}
              onClick={() => setActiveSegment(seg.id as CRMSegment)}
              className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all duration-200 ${
                active 
                  ? `${seg.activeColor} shadow-md scale-[1.02]` 
                  : `${seg.color} hover:bg-opacity-20`
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4.5 w-4.5" />
                <span className="text-xs font-bold">{seg.label}</span>
              </div>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                active 
                  ? "bg-white/20 text-white dark:bg-black/10 dark:text-black" 
                  : "bg-black/5 dark:bg-white/10"
              }`}>{seg.count}</span>
            </button>
          );
        })}
      </div>

      {/* List & Search */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Search by name or phone number..." 
              className="pl-10 h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-base"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400 mb-4" />
            <p className="text-sm text-slate-500">Loading customers...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="mx-auto h-16 w-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="font-bold text-slate-700 dark:text-slate-300">No customers found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              {search ? "No matches for your search." : "No customers found in this segment. Segment updates automatically based on purchase history."}
            </p>
            {!search && activeSegment === "all" && (
              <Button onClick={() => setIsAdding(true)} variant="outline" className="mt-6 font-semibold">
                <Plus className="mr-2 h-4 w-4" /> Add First Customer
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map(c => {
              // WhatsApp Promo templating
              const storeName = customerStats?.agentProfile?.store_name || "our store";
              const storeSlug = customerStats?.agentProfile?.store_slug || "";
              const storeLink = `${window.location.origin}/store/${storeSlug}`;
              
              const promoText = `Hey ${c.name}! 👋 This is ${storeName}. Just letting you know that new MTN and Telecel data bundles have just landed on our store at ultra-cheap wholesale prices! 🚀 Get yours instantly here: ${storeLink}`;
              const whatsappUrl = `https://wa.me/${c.phone.replace(/\D/g, "")}?text=${encodeURIComponent(promoText)}`;

              return (
                <div key={c.id} className="p-4 sm:px-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-900 dark:to-fuchsia-900 flex items-center justify-center text-violet-700 dark:text-violet-300 font-black text-lg relative">
                      {c.name.charAt(0).toUpperCase()}
                      {c.segment === "vip" && (
                        <span className="absolute -top-1.5 -right-1 text-xs">👑</span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 dark:text-white">{c.name}</h4>
                        {c.segment === "vip" && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-extrabold uppercase">VIP</span>
                        )}
                        {c.segment === "slipping" && (
                          <span className="px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[9px] font-extrabold uppercase">Slipping</span>
                        )}
                        {c.segment === "inactive" && (
                          <span className="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[9px] font-extrabold uppercase">Inactive</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-slate-500 font-mono font-medium">{c.phone}</p>
                        <span className="text-slate-300 dark:text-slate-700 text-xs">•</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Purchases:</span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{c.orderCount}</span>
                          {/* Sparkline visualization */}
                          {c.orderCount > 0 && (
                            <div className="flex items-end h-3 ml-1.5 gap-0.5">
                              {Array.from({ length: Math.min(6, c.orderCount) }).map((_, idx) => (
                                <span 
                                  key={idx} 
                                  className="w-0.75 bg-violet-500 dark:bg-violet-400 rounded-full inline-block"
                                  style={{ height: `${(idx + 1) * 2}px` }} 
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {/* In-App Notification Trigger */}
                    {c.orderCount > 0 && (
                      <Button
                        onClick={() => {
                          setSelectedPhone(c.phone);
                          setSelectedName(c.name);
                          setAlertTitle("Store Update!");
                          setAlertMessage(`Hi ${c.name}, we have loaded new data bundles for you!`);
                          setAlertOpen(true);
                        }}
                        className="inline-flex h-9 items-center justify-center gap-1.5 px-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-md shadow-violet-600/10 hover:shadow-violet-600/20 transition-all hover:scale-105"
                      >
                        <Bell className="h-3.5 w-3.5" />
                        <span>Alert</span>
                      </Button>
                    )}

                    {/* One-click WhatsApp Retargeting Trigger */}
                    {(c.segment === "slipping" || c.segment === "inactive") && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center justify-center gap-1.5 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all hover:scale-105"
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span>Promo</span>
                      </a>
                    )}
                    
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => { setFormName(c.name); setFormPhone(c.phone); setEditingId(c.id); setIsAdding(false); }}
                      className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDelete(c.id)}
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── SEND INDIVIDUAL CUSTOMER ALERT ── */}
      <Dialog open={alertOpen} onOpenChange={setAlertOpen}>
        <DialogContent className="w-[94vw] max-w-sm rounded-[32px] border-border p-6 bg-card text-foreground">
          <DialogHeader>
            <DialogTitle className="text-left text-lg font-black flex items-center gap-1.5 text-foreground">
              <Bell className="h-5 w-5 text-violet-600 animate-bounce" /> Send Customer Alert
            </DialogTitle>
            <DialogDescription className="text-left text-xs text-muted-foreground">
              Send a real-time push notification alert directly to **{selectedName}**.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendAlert} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-muted-foreground uppercase">Alert Title</label>
              <Input
                placeholder="e.g. Gig Bundle Update"
                value={alertTitle}
                onChange={(e) => setAlertTitle(e.target.value)}
                className="h-11 rounded-2xl border-border text-sm font-semibold focus-visible:ring-violet-500 text-foreground"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-muted-foreground uppercase">Notification Message</label>
              <textarea
                placeholder="Write your custom alert message here..."
                value={alertMessage}
                onChange={(e) => setAlertMessage(e.target.value)}
                className="w-full min-h-[80px] rounded-2xl border border-border bg-transparent px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500/20 transition-all resize-none text-foreground"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-muted-foreground uppercase">Type</label>
                <select
                  value={alertType}
                  onChange={(e) => setAlertType(e.target.value)}
                  className="w-full h-11 rounded-2xl border border-border bg-background px-3 text-sm focus:ring-violet-500 focus:outline-none text-foreground"
                >
                  <option value="info">Info (Blue)</option>
                  <option value="success">Success (Green)</option>
                  <option value="warning">Warning (Amber)</option>
                  <option value="error">Alert (Red)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-muted-foreground uppercase">Chime Sound</label>
                <select
                  value={alertSound}
                  onChange={(e) => setAlertSound(e.target.value)}
                  className="w-full h-11 rounded-2xl border border-border bg-background px-3 text-sm focus:ring-violet-500 focus:outline-none text-foreground"
                >
                  <option value="default">Pop (Default)</option>
                  <option value="success">Chime (Success)</option>
                  <option value="paystack">Coin (Earning)</option>
                  <option value="alert">Siren (Alert)</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={isSendingAlert}
                className="w-full h-11 rounded-2xl font-bold bg-violet-600 hover:bg-violet-700 text-white transition-all flex items-center justify-center gap-1.5"
              >
                {isSendingAlert ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                Send Live Notification
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

