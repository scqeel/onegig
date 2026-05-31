import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNetworks, useBundles, BundleRow, NetworkRow } from "@/hooks/useNetworksAndBundles";
import { TrackOrder } from "@/components/buy/TrackOrder";
import { WalletManager } from "@/components/agent/WalletManager";
import { DraggableWhatsApp } from "@/components/agent/DraggableWhatsApp";
import { DraggableWidget } from "@/components/agent/DraggableWidget";
import { OwnerDashboard } from "@/components/agent/OwnerDashboard";
import { AgentLogin } from "@/components/agent/AgentLogin";
import { formatGHS } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Store,
  Phone,
  MessageCircle,
  Loader2,
  Calendar,
  Receipt,
  Layers,
  Zap,
  Shield,
  Wifi,
  ChevronRight,
  Headphones,
  Check,
  ShoppingBag,
  Gift,
  Database,
  Wallet,
  Trophy,
  Mail,
  MapPin,
  Clock,
  ArrowRight,
  Lock,
  Paintbrush,
  Sparkles,
  RefreshCcw,
  CheckCircle2,
  Bell,
  Share,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Tab = "orders" | "trans" | "bulk" | "store";
type ThemeAccent = "rose" | "indigo" | "amber" | "emerald" | "violet";
type Phase = "select" | "processing" | "otp" | "polling" | "delivering" | "success" | "error";

function getNetStyle(code: string) {
  const c = code.toUpperCase();
  if (c === "MTN")
    return {
      cardIdle: "border-[#f2c000] bg-[#ffcc00] text-black hover:bg-[#e6b800] transition-colors",
      cardActive: "border-black bg-[#e6b800] text-black shadow-lg ring-2 ring-black",
    };
  if (c === "TELECEL")
    return {
      cardIdle: "border-[#b30000] bg-[#cc0000] text-white hover:bg-[#b30000] transition-colors",
      cardActive: "border-black bg-[#b30000] text-white shadow-lg ring-2 ring-black",
    };
  if (c === "AIRTELTIGO" || c === "AT")
    return {
      cardIdle: "border-[#380b6b] bg-[#4a148c] text-white hover:bg-[#380b6b] transition-colors",
      cardActive: "border-black bg-[#380b6b] text-white shadow-lg ring-2 ring-black",
    };
  
  return {
    cardIdle: "border-blue-600 bg-blue-600 text-white hover:bg-blue-700 transition-colors",
    cardActive: "border-black bg-blue-700 text-white shadow-lg ring-2 ring-black",
  };
}

const FOMO_NAMES = ["Kwame", "Ama", "Kojo", "Adwoa", "Yaw", "Yaa", "Kofi", "Efua", "Kwasi", "Akosua", "Emmanuel", "Grace"];
const FOMO_BUNDLES = ["10GB MTN", "5GB Telecel", "2GB AT", "15GB MTN", "3GB Telecel", "20GB AT", "1GB MTN", "7GB MTN"];

function StorefrontNotificationsModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('og_store_dismissed_notifications');
      if (stored) setDismissedIds(JSON.parse(stored));
    } catch(e) {}
  }, []);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open]);

  const fetchNotifications = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('app_notifications')
      .select('*')
      .eq('is_global', true)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (!error && data) {
      setNotifications(data);
    }
    setLoading(false);
  };

  const handleDismiss = (id: string) => {
    const newDismissed = [...dismissedIds, id];
    setDismissedIds(newDismissed);
    localStorage.setItem('og_store_dismissed_notifications', JSON.stringify(newDismissed));
  };

  const activeNotifications = notifications.filter(n => !dismissedIds.includes(n.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-none rounded-[32px] p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Bell className="h-5 w-5 text-indigo-500" /> Notifications
          </DialogTitle>
          <DialogDescription className="text-xs font-medium text-slate-500">
            Latest announcements and updates.
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto pr-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
          ) : activeNotifications.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              <p className="text-sm font-bold text-slate-400">All caught up!</p>
              <p className="text-xs text-slate-500 mt-1">No new notifications.</p>
            </div>
          ) : (
            activeNotifications.map(n => (
              <div key={n.id} className="relative p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 group transition-all">
                <button 
                  onClick={() => handleDismiss(n.id)}
                  className="absolute top-3 right-3 text-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 pr-6">{n.title}</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{n.message}</p>
                <div className="mt-2 text-[9px] font-black uppercase text-indigo-400/80">
                  {new Date(n.created_at).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AgentStorePage({ customDomainSlug }: { customDomainSlug?: string }) {
  const { slug: routeSlug } = useParams<{ slug: string }>();
  const slug = customDomainSlug || routeSlug;
  const nav = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();

  // Navigation & Theme tabs
  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const [accent, setAccent] = useState<ThemeAccent>("rose");
  const [currentTime, setCurrentTime] = useState("");
  const [viewMode, setViewMode] = useState<"storefront" | "dashboard">("storefront");
  const [loginOpen, setLoginOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Order state
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkRow | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<BundleRow | null>(null);
  const [phone, setPhone] = useState(profile?.phone || "");
  const [momoNumber, setMomoNumber] = useState("");
  const [momoNetwork, setMomoNetwork] = useState<string>("MTN");
  const [email, setEmail] = useState(profile?.email || "");
  const [phase, setPhase] = useState<Phase>("select");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [otpTimer, setOtpTimer] = useState(0);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Promo Coupon Code States
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);

  // Dialog / Info popup states
  const [infoPopup, setInfoPopup] = useState<{ open: boolean; title: string; content: string } | null>(null);

  // 1. Fetch Agent Profile
  const { data: agent, isLoading: loadingAgent, isError } = useQuery({
    queryKey: ["public-store", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_profiles")
        .select("*")
        .eq("store_slug", slug!)
        .eq("activation_paid", true)
        .maybeSingle();
      return data as any;
    },
  });

  // 2. Fetch Agent Custom Pricing
  const { data: priceOverrides, isLoading: loadingPrices } = useQuery({
    queryKey: ["store-prices", agent?.id],
    enabled: !!agent?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_bundle_prices")
        .select("bundle_id, sell_price")
        .eq("agent_id", agent!.id)
        .eq("active", true);
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        map[r.bundle_id] = Number(r.sell_price);
      });
      return map;
    },
  });

  // 3. Fetch Networks & Bundles
  const { data: networks = [], isLoading: loadingNetworks } = useNetworks();
  const { data: bundles = [], isLoading: loadingBundles } = useBundles(selectedNetwork?.id ?? null);

  const isOwner = profile?.id === agent?.user_id;

  // Fetch Agent's CRM customers if they are the owner
  const { data: crmCustomers } = useQuery({
    queryKey: ["agent-crm-customers", agent?.id],
    enabled: !!isOwner && !!agent?.id,
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("crm-manage", {
        body: { action: "list" }
      });
      return data?.customers || [];
    }
  });

  // 1. AI Storefront Assistant States & Handlers
  const [aiOpen, setAiOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "user" | "bot"; text: string }>>([
    { sender: "bot", text: "Hello! 👋 I'm your virtual storefront assistant. How can I help you choose the best data bundle or complete your payment today?" }
  ]);

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatMessages(p => [...p, { sender: "user", text }]);
    setChatInput("");

    setTimeout(() => {
      let reply = "I'm not completely sure about that, but you can place an order directly by selecting a bundle above and paying with Momo. Your bundle is delivered instantly within 60 seconds!";
      const q = text.toLowerCase();

      if (q.includes("hi") || q.includes("hello") || q.includes("hey")) {
        reply = "Hello! 👋 How can I help you today? Ask me about data bundles, checkout help, or delivery times!";
      } else if (q.includes("mtn")) {
        reply = "We offer premium MTN data bundles. They are extremely cheap, work instantly, and do not expire! Scroll up to check our active MTN plans.";
      } else if (q.includes("telecel") || q.includes("vodafone") || q.includes("voda")) {
        reply = "Yes, Telecel (formerly Vodafone) bundles are fully supported and delivered instantly. Scroll to the Telecel section to choose your size!";
      } else if (q.includes("airtel") || q.includes("tigo") || q.includes("at")) {
        reply = "We have cheap AirtelTigo (AT) plans. Select the AirtelTigo network tab above to view custom rates.";
      } else if (q.includes("delivery") || q.includes("time") || q.includes("speed") || q.includes("how long")) {
        reply = "All data bundles are sent instantly via automated wholesale gateways. Fulfillments typically complete within 30 to 60 seconds of Momo payment completion.";
      } else if (q.includes("discount") || q.includes("coupon") || q.includes("promo")) {
        reply = "You can enter a promo code (like WELCOME5) directly in the checkout dialog to get an instant discount! Ask our storefront agent if they have any custom codes active.";
      } else if (q.includes("streaming") || q.includes("youtube") || q.includes("netflix") || q.includes("movie")) {
        reply = "For streaming videos and movies, we highly recommend our gold-tier 10GB or 20GB bundles. They offer the best cedi-to-gigabyte value and last a long time!";
      } else if (q.includes("work") || q.includes("how to") || q.includes("buy")) {
        reply = "It's super easy! 1. Choose a network. 2. Select your data bundle. 3. Enter the recipient number and your mobile money number. 4. Complete the checkout payment. Your data arrives in under a minute!";
      } else if (q.includes("contact") || q.includes("owner") || q.includes("support")) {
        reply = `You can contact our store support agent directly via the green WhatsApp button floating on your screen or dial our support number listed in the store details!`;
      }

      setChatMessages(p => [...p, { sender: "bot", text: reply }]);
    }, 600);
  };

  // 2. Loyalty Rewards Hub States & Handlers
  const [loyaltyOpen, setLoyaltyOpen] = useState(false);
  const [loyaltyPhone, setLoyaltyPhone] = useState("");
  const [loyaltyPointsBalance, setLoyaltyPointsBalance] = useState<number | null>(null);
  const [isCheckingLoyalty, setIsCheckingLoyalty] = useState(false);
  const [pointsRedeemed, setPointsRedeemed] = useState(0); // in GH₵ discount

  const checkLoyaltyPoints = async () => {
    if (!loyaltyPhone.trim() || !agent?.id) return;
    setIsCheckingLoyalty(true);
    try {
      const clean = loyaltyPhone.replace(/\D/g, "");
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone", clean)
        .maybeSingle();

      if (!profileRow) {
        toast({ title: "No loyalty history", description: "You don't have any purchase history on this store yet.", variant: "destructive" });
        setIsCheckingLoyalty(false);
        return;
      }

      const { data: loyaltyRow } = await supabase
        .from("loyalty_points")
        .select("points_balance")
        .eq("user_id", profileRow.id)
        .eq("agent_id", agent.id)
        .maybeSingle();

      setLoyaltyPointsBalance(loyaltyRow?.points_balance ?? 0);
    } catch (e) {
      toast({ title: "Failed to check points", variant: "destructive" });
    } finally {
      setIsCheckingLoyalty(false);
    }
  };

  const redeemLoyaltyPoints = () => {
    if (loyaltyPointsBalance == null || loyaltyPointsBalance < 10) {
      toast({ title: "Insufficient points", description: "You need at least 10 points to redeem a discount.", variant: "destructive" });
      return;
    }
    
    const discount = Math.floor(loyaltyPointsBalance / 10); // GH₵ discount
    const bundleCost = selectedBundle ? priceFor(selectedBundle) : 0;
    const finalDiscount = Math.min(bundleCost - 1, discount); // ensure total is at least GHS 1.00

    setPointsRedeemed(finalDiscount);
    toast({ title: "Points Redeemed!", description: `You unlocked a GH₵ ${finalDiscount.toFixed(2)} discount using your loyalty points!` });
  };

  // 3. Momo Subscription States
  const [subscribeChecked, setSubscribeChecked] = useState(false);
  const [subscriptionFrequency, setSubscriptionFrequency] = useState<"weekly" | "monthly">("monthly");

  // 4. Dynamic Font loader
  useEffect(() => {
    if (agent?.store_font_family) {
      const font = agent.store_font_family;
      const linkId = "og-store-font";
      let link = document.getElementById(linkId) as HTMLLinkElement;
      if (!link) {
        link = document.createElement("link");
        link.id = linkId;
        link.rel = "stylesheet";
        document.head.appendChild(link);
      }
      link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/\s+/g, "+")}:wght@400;600;800;900&display=swap`;
      document.body.style.fontFamily = `'${font}', sans-serif`;
    }
    return () => {
      document.body.style.fontFamily = "";
    };
  }, [agent?.store_font_family]);

  // Widget settings
  const [widgetEnabled, setWidgetEnabled] = useState(() => {
    return localStorage.getItem("og_whatsapp_widget") !== "false";
  });

  const toggleWidget = () => {
    const newState = !widgetEnabled;
    setWidgetEnabled(newState);
    localStorage.setItem("og_whatsapp_widget", String(newState));
  };


  // Live ticking clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("en-US", { hour12: true }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Redirect if agent store not found
  useEffect(() => {
    if (!loadingAgent && (isError || !agent)) {
      nav("/", { replace: true });
    }
  }, [loadingAgent, isError, agent, nav]);

  // Pre-fill fields once profile loads
  useEffect(() => {
    if (profile) {
      if (profile.phone && !phone) setPhone(profile.phone);
      if (profile.phone && !momoNumber) setMomoNumber(profile.phone);
      if (profile.email && !email) setEmail(profile.email);
    }
  }, [profile]);

  // Log page_view storefront analytics
  useEffect(() => {
    if (agent?.id) {
      let sessionToken = sessionStorage.getItem("storefront_session");
      if (!sessionToken) {
        sessionToken = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
        sessionStorage.setItem("storefront_session", sessionToken);
      }
      supabase
        .from("storefront_analytics")
        .insert({
          agent_id: agent.id,
          session_token: sessionToken,
          event_type: "page_view",
          metadata: {
            referrer: document.referrer || null,
            user_agent: navigator.userAgent || null,
          },
        })
        .then(({ error }) => {
          if (error) console.warn("Analytics page_view error:", error.message);
        });
    }
  }, [agent?.id]);

  // Reset coupon state when bundle or network changes
  useEffect(() => {
    setAppliedCoupon(null);
    setCouponCodeInput("");
    setCouponError(null);
  }, [selectedBundle, selectedNetwork]);

  const applyCouponCode = async () => {
    if (!couponCodeInput.trim() || !agent?.id) return;
    setIsCheckingCoupon(true);
    setCouponError(null);

    try {
      const cleanCode = couponCodeInput.trim().toUpperCase();
      const { data: coupon, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", cleanCode)
        .eq("active", true)
        .maybeSingle();

      if (error || !coupon) {
        setCouponError("Invalid or expired promo code.");
        setIsCheckingCoupon(false);
        return;
      }

      // Check remaining uses
      if (coupon.current_uses >= coupon.max_uses) {
        setCouponError("Promo code usage limit reached.");
        setIsCheckingCoupon(false);
        return;
      }

      // Check agent restrictions (must be global admin, or match this agent's storefront id)
      if (coupon.agent_id && coupon.agent_id !== agent.id) {
        setCouponError("This promo code is not valid for this storefront.");
        setIsCheckingCoupon(false);
        return;
      }

      // Verify discount is reasonable (does not exceed selected bundle cost)
      const bundleCost = selectedBundle ? priceFor(selectedBundle) : 0;
      if (Number(coupon.discount_amount) >= bundleCost) {
        setCouponError("Discount exceeds bundle price.");
        setIsCheckingCoupon(false);
        return;
      }

      setAppliedCoupon(coupon);
      toast({
        title: "Promo Code Applied!",
        description: `You saved GH₵ ${Number(coupon.discount_amount).toFixed(2)} off your purchase.`,
      });
    } catch (e: any) {
      setCouponError("Failed to validate promo code.");
    } finally {
      setIsCheckingCoupon(false);
    }
  };

  // Set default momo network when selectedNetwork changes
  useEffect(() => {
    if (!selectedNetwork && networks.length) setSelectedNetwork(networks[0]);
    if (selectedNetwork && selectedNetwork.code) {
      setMomoNetwork(selectedNetwork.code);
    }
  }, [networks, selectedNetwork]);

  useEffect(() => {
    const num = momoNumber.replace(/\D/g, "");
    if (num.length >= 10 && checkoutOpen) {
      setAccountName(null);
      setIsVerifying(true);
      const timer = setTimeout(async () => {
        try {
          const { data } = await supabase.functions.invoke("paystack-resolve", {
            body: { momo_number: num, momo_network: momoNetwork }
          });
          if (data?.ok && data?.account_name) {
            setAccountName(data.account_name);
          } else {
            setAccountName(data?.error ? "Account not found" : "Unknown Account");
          }
        } catch (e) {
          setAccountName("Unknown Account");
        } finally {
          setIsVerifying(false);
        }
      }, 600);
      return () => clearTimeout(timer);
    } else {
      setAccountName(null);
      setIsVerifying(false);
    }
  }, [momoNumber, momoNetwork, checkoutOpen]);
  useEffect(() => {
    if (phase !== "polling" || !orderRef) return;
    
    let interval: any;
    let attempts = 0;
    let isTransitioning = false;

    const checkStatus = async () => {
      if (isTransitioning) return;
      attempts++;
      if (attempts > 40) {
        setPhase("error");
        setErrorMsg("Payment timed out. Please try again.");
        return clearInterval(interval);
      }

      const { data, error } = await supabase.functions.invoke("paystack-verify", {
        body: { reference: orderRef }
      });

      if (error) {
        setAuthMessage("Network issue while checking status...");
      } else if (data) {
        if (["pending", "processing", "ongoing", "pay_offline"].includes(data.status?.toLowerCase())) {
          setAuthMessage(`Please check your phone to authorize the payment...`);
        } else if (data.status === "send_otp") {
          setAuthMessage("OTP is required to authorize the payment...");
        } else {
          setAuthMessage(`Processing payment status: ${data.status || 'verified'}...`);
        }
      }

      if (data?.ok) {
        clearInterval(interval);
        
        // Log storefront payment_success analytics
        const sessionToken = sessionStorage.getItem("storefront_session") || "anonymous";
        supabase
          .from("storefront_analytics")
          .insert({
            agent_id: agent.id,
            session_token: sessionToken,
            event_type: "payment_success",
            metadata: {
              bundle_id: selectedBundle!.id,
              size_label: selectedBundle!.size_label,
              network: selectedNetwork?.name || null,
              amount: finalPrice,
              reference: orderRef,
            },
          })
          .then(({ error }) => {
            if (error) console.warn("Analytics payment_success error:", error.message);
          });

        setPhase("success");
      } else if (data?.error) {
        clearInterval(interval);
        setPhase("error");
        setErrorMsg(data.error);
      } else if (data?.status && !["pending", "processing", "ongoing", "send_otp", "pay_offline"].includes(data.status.toLowerCase())) {
        clearInterval(interval);
        setPhase("error");
        setErrorMsg(`Payment failed: ${data.status}`);
      }
    };

    interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [phase, orderRef]);


  if (loadingAgent || loadingPrices || !agent) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
        <p className="mt-4 text-xs font-semibold text-slate-400 animate-pulse">Loading Reseller Storefront...</p>
      </div>
    );
  }

  // Theme configuration mappings
  const accentClasses: Record<ThemeAccent, { primary: string; border: string; bg: string; text: string; gradient: string }> = {
    rose: {
      primary: "#f43f5e",
      border: "border-rose-500/20",
      bg: "bg-rose-500/10",
      text: "text-rose-500",
      gradient: "from-rose-500 to-pink-600",
    },
    indigo: {
      primary: "#6366f1",
      border: "border-indigo-500/20",
      bg: "bg-indigo-500/10",
      text: "text-indigo-500",
      gradient: "from-indigo-500 to-violet-600",
    },
    amber: {
      primary: "#d97706",
      border: "border-amber-500/20",
      bg: "bg-amber-500/10",
      text: "text-amber-500",
      gradient: "from-amber-500 to-orange-600",
    },
    emerald: {
      primary: "#10b981",
      border: "border-emerald-500/20",
      bg: "bg-emerald-500/10",
      text: "text-emerald-500",
      gradient: "from-emerald-500 to-teal-600",
    },
    violet: {
      primary: "#8b5cf6",
      border: "border-violet-500/20",
      bg: "bg-violet-500/10",
      text: "text-violet-500",
      gradient: "from-violet-500 to-fuchsia-600",
    },
  };

  const currentAccent = accentClasses[accent];

  const theme = agent?.store_template_theme || "minimalist";
  const isDarkStore = agent?.store_dark_mode || false;
  
  const getStoreBgClass = () => {
    if (theme === "cyberpunk") {
      return "min-h-dvh pb-24 bg-black text-cyan-400 font-mono";
    }
    if (theme === "luxury") {
      return "min-h-dvh pb-24 bg-stone-950 text-stone-100";
    }
    return `min-h-dvh pb-24 transition-colors duration-300 ${
      isDarkStore ? "dark bg-slate-950 text-slate-100" : "bg-[#f8fafc] text-slate-900"
    }`;
  };

  const getCardClass = () => {
    switch (theme) {
      case "glassmorphism":
        return "bg-white/40 dark:bg-slate-900/30 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-lg text-slate-800 dark:text-slate-200";
      case "cyberpunk":
        return "bg-zinc-950 border-2 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)] text-cyan-400 font-mono";
      case "luxury":
        return "bg-gradient-to-br from-stone-900 to-stone-950 border border-amber-500/25 shadow-xl text-stone-100";
      case "minimalist":
      default:
        return "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 shadow-sm text-slate-800 dark:text-slate-100";
    }
  };

  // Helper to get sell price
  const priceFor = (b: BundleRow) =>
    priceOverrides && priceOverrides[b.id] != null
      ? priceOverrides[b.id]
      : Number(b.user_price ?? b.base_price);

  const baseFinalPrice = selectedBundle ? priceFor(selectedBundle) : 0;
  const priceAfterCoupon = appliedCoupon
    ? Math.max(0, baseFinalPrice - Number(appliedCoupon.discount_amount))
    : baseFinalPrice;
  const finalPrice = Math.max(1, priceAfterCoupon - pointsRedeemed);

  if (isOwner && viewMode === "dashboard") {
    return <OwnerDashboard agent={agent} slug={slug || ""} onPreviewStore={() => setViewMode("storefront")} />;
  }

  // Checkout flow
  const initiatePayment = async () => {
    if (!selectedBundle || !phone || phone.replace(/\D/g, "").length < 9) {
      toast({ title: "Enter recipient phone", variant: "destructive" });
      return;
    }
    if (!momoNumber || momoNumber.replace(/\D/g, "").length < 9) {
      toast({ title: "Enter mobile money number", variant: "destructive" });
      return;
    }

    setCheckoutOpen(false);
    setPhase("processing");
    
    // Log storefront checkout_initiated analytics
    const sessionToken = sessionStorage.getItem("storefront_session") || "anonymous";
    supabase
      .from("storefront_analytics")
      .insert({
        agent_id: agent.id,
        session_token: sessionToken,
        event_type: "checkout_initiated",
        metadata: {
          bundle_id: selectedBundle.id,
          size_label: selectedBundle.size_label,
          network: selectedNetwork?.name || null,
          amount: finalPrice,
        },
      })
      .then(({ error }) => {
        if (error) console.warn("Analytics checkout_initiated error:", error.message);
      });

    try {
      const { data, error } = await supabase.functions.invoke("paystack-process", {
        body: {
          purpose: "order",
          recipient_phone: phone.replace(/\D/g, ""),
          bundle_id: selectedBundle.id,
          agent_slug: slug ?? null,
          momo_number: momoNumber,
          momo_network: momoNetwork,
          email: email || "guest@mtopup.shop",
          coupon_code: appliedCoupon?.code || null,
          subscribe: subscribeChecked,
          frequency: subscriptionFrequency,
          points_redeemed: pointsRedeemed,
        },
      });

      if (error || data?.error) {
        const errPayload = data?.error || error?.message || "Payment initialization failed";
        const errMsg = typeof errPayload === "object" ? JSON.stringify(errPayload) : errPayload;
        setErrorMsg(errMsg);
        setPhase("error");
        return;
      }

      if (data?.status === "send_otp") {
        setOrderRef(data.reference);
        setAuthMessage(data?.message || null);
        setOtpTimer(60);
        setPhase("otp");
        return;
      }

      setOrderRef(data.reference);
      setAuthMessage(data?.message || null);
      setPhase("polling");
    } catch (e: any) {
      setErrorMsg(e.message || "An unexpected error occurred.");
      setPhase("error");
    }
  };

  const submitOtp = async (overrideOtp?: string | React.MouseEvent) => {
    const finalOtp = typeof overrideOtp === 'string' ? overrideOtp : otp;
    if (!finalOtp || !orderRef) return;
    setPhase("processing");
    
    try {
      const { data, error } = await supabase.functions.invoke("paystack-process", {
        body: {
          action: "submit_otp",
          otp: finalOtp,
          reference: orderRef,
          purpose: "order",
          momo_number: "0",
          momo_network: "MTN"
        },
      });

      if (error || data?.error) {
        setPhase("error");
        setErrorMsg(data?.error || error?.message || "Failed to submit OTP");
        return;
      }

      if (data?.status === "send_otp") {
        setPhase("otp");
        setErrorMsg(data?.message || "Incorrect OTP, please try again.");
        return;
      }

      setPhase("polling");
    } catch (e: any) {
      setErrorMsg(e.message || "An unexpected error occurred.");
      setPhase("error");
    }
  };

  const resendPaymentOtp = async () => {
    if (otpTimer > 0) return;
    setPhase("processing");
    try {
      const { data, error } = await supabase.functions.invoke("paystack-process", {
        body: {
          purpose: "order",
          recipient_phone: phone.replace(/\D/g, ""),
          bundle_id: selectedBundle!.id,
          agent_slug: slug ?? null,
          momo_number: momoNumber,
          momo_network: momoNetwork,
          email: email || "guest@mtopup.shop",
        },
      });

      if (error || data?.error) {
        setErrorMsg(data?.error || error?.message || "Failed to resend OTP");
        setPhase("error");
        return;
      }

      if (data?.status === "send_otp") {
        setOrderRef(data.reference);
        setOtpTimer(60);
        setPhase("otp");
        toast({ title: "OTP Resent", description: "A new OTP has been sent." });
      } else {
        setOrderRef(data.reference);
        setPhase("polling");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to resend OTP");
      setPhase("error");
    }
  };





  const handleQuickAction = (action: string) => {
    if (action === "order" || action === "data") {
      setActiveTab("orders");
      setTimeout(() => {
        document.getElementById("place-new-order")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else if (action === "trans") {
      setActiveTab("trans");
    } else if (action === "store") {
      setActiveTab("store");
    } else if (action === "reward") {
      setInfoPopup({
        open: true,
        title: "Customer Rewards Program",
        content: "Our reseller loyalty rewards program is launching soon! Earn reward points on every data bundle purchase that can be redeemed for free data bundles or cashbacks.",
      });
    } else if (action === "deposit") {
      setInfoPopup({
        open: true,
        title: "Wallet Deposits",
        content: "To deposit funds into your reseller wallet balance, please navigate to your Agent Dashboard Settings or contact the platform administrator at support@mtopup.shop.",
      });
    } else if (action === "vendor") {
      setInfoPopup({
        open: true,
        title: "Become a Reseller",
        content: "Want to start your own profitable data resell business? Get cheap data bundles at wholesale prices and set your own profit margins. Sign up today via our home page!",
      });
    } else if (action === "rollover") {
      setInfoPopup({
        open: true,
        title: "Data Rollover Policy",
        content: "Data bundles do not roll over automatically. To retain unused data balance, please ensure to top-up/renew your bundle before your current bundle expiration date.",
      });
    }
  };

  // Switch dynamically through accent colors
  const rotateAccent = () => {
    const orders: ThemeAccent[] = ["rose", "indigo", "amber", "emerald", "violet"];
    const nextIdx = (orders.indexOf(accent) + 1) % orders.length;
    setAccent(orders[nextIdx]);
  };

  if (phase === "success") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#f8fafc] dark:bg-slate-950 p-6 text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-lg">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        </div>
        <h3 className="mt-6 text-3xl font-black text-slate-800 dark:text-white">Order Successful! 🎉</h3>
        <p className="mt-2 font-medium text-slate-500 dark:text-slate-400">
          Data has been delivered to <span className="font-extrabold text-slate-800 dark:text-slate-200">{phone}</span>
        </p>
        <div className="mt-8">
          <Button onClick={() => setPhase("select")} className="h-12 rounded-2xl bg-slate-950 text-white dark:bg-slate-800 font-bold px-8">
            Return to Store
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#f8fafc] dark:bg-slate-950 p-6 text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 shadow-lg">
          <RefreshCcw className="h-12 w-12 text-red-500" />
        </div>
        <h3 className="mt-6 text-xl font-black text-slate-800 dark:text-white">Payment Failed</h3>
        <p className="mt-2 font-medium text-red-500">{errorMsg}</p>
        <div className="mt-8">
          <Button onClick={() => { setPhase("select"); setOtp(""); setAuthMessage(null); }} className="h-12 rounded-2xl bg-slate-950 text-white dark:bg-slate-800 font-bold px-8">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "otp") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#f8fafc] dark:bg-slate-950 p-6 text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/20 shadow-lg">
          <Lock className="h-10 w-10 text-blue-500" />
        </div>
        <h3 className="mt-6 text-2xl font-black text-slate-800 dark:text-white">Verification Required</h3>
        <p className="mt-2 font-medium text-slate-500 dark:text-slate-400 max-w-[280px]">
          Please enter the OTP or Voucher Code sent to your mobile number ({momoNumber}).
        </p>
        
        {errorMsg && (
          <p className="mt-3 text-sm font-bold text-red-500">{errorMsg}</p>
        )}

        <div className="mt-8 w-full max-w-[280px] space-y-4">
          <div className="flex justify-center pb-2">
            <InputOTP 
              maxLength={6} 
              value={otp} 
              onChange={(val) => {
                setOtp(val);
                if (val.length === 6 && phase === "otp") {
                  submitOtp(val);
                }
              }}
            >
              <InputOTPGroup className="gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot 
                    key={i} 
                    index={i} 
                    className="h-12 w-11 rounded-[12px] border border-slate-200 bg-white text-lg font-black shadow-sm transition-all focus-visible:border-blue-500 focus-visible:ring-4 focus-visible:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-900" 
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          
          <div className="flex items-center justify-between px-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => { setPhase("select"); setOtp(""); setAuthMessage(null); }}
              className="h-auto p-0 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white"
            >
              Cancel Order
            </Button>
            
            {otpTimer > 0 ? (
              <span className="text-xs text-slate-500 font-medium">Resend in <span className="text-slate-800 dark:text-slate-200 font-bold">{otpTimer}s</span></span>
            ) : (
              <Button
                variant="ghost"
                onClick={resendPaymentOtp}
                className="h-auto p-0 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline hover:text-blue-700 dark:hover:text-blue-300"
              >
                Try again
              </Button>
            )}
          </div>

          {/* Visible submit button to allow manual submission */}
          <div className="mt-6">
            <Button 
              id="btn-agent-otp-submit" 
              onClick={() => submitOtp()} 
              disabled={otp.length < 4}
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              Verify OTP
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "processing" || phase === "polling" || phase === "delivering") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#f8fafc] dark:bg-slate-950 p-6 text-center">
        <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/20 shadow-lg animate-pulse">
          {phase === "delivering" ? <CheckCircle2 className="h-14 w-14 text-emerald-500" /> : <Loader2 className="h-14 w-14 text-blue-500 animate-spin" />}
        </div>
        <h3 className="mt-8 text-2xl font-black text-slate-800 dark:text-white">
          {phase === "processing" && "Initiating Payment..."}
          {phase === "polling" && "Awaiting Authorization"}
          {phase === "delivering" && "Payment Received! Sending Data..."}
        </h3>
        
        {phase === "polling" && (
          <div className="mt-4 flex flex-col items-center">
            <div className="flex items-center gap-2.5 text-sm font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-5 py-2.5 rounded-full border border-blue-200 dark:border-blue-800/50 shadow-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
              </span>
              {authMessage || `Please check your phone (${momoNumber}) to authorize...`}
            </div>
          </div>
        )}

        {phase === "delivering" && (
          <p className="mt-4 text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-5 py-2.5 rounded-full border border-emerald-200 dark:border-emerald-800/50 shadow-sm inline-block">
            Connecting to {selectedNetwork?.name} network to deliver your bundle.
          </p>
        )}
        
        <p className="mt-6 text-xs font-medium text-slate-500 dark:text-slate-400">
          Do not close this window. Your bundle will be delivered automatically.
        </p>

        {(phase === "polling" || phase === "delivering") && (
          <div className="mt-6 flex items-center justify-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700 animate-bounce" />
            <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700 animate-bounce [animation-delay:0.2s]" />
            <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700 animate-bounce [animation-delay:0.4s]" />
          </div>
        )}
      </div>
    );
  }

  const handleShareStore = () => {
    if (navigator.share) {
      navigator.share({
        title: agent.store_name,
        text: agent.store_tagline || "Buy cheap data bundles from my store!",
        url: window.location.href,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link Copied!",
        description: "Store link copied to clipboard.",
      });
    }
  };

  return (
    <div className={`${getStoreBgClass()} relative overflow-hidden`}>
      <StorefrontNotificationsModal open={notificationsOpen} onOpenChange={setNotificationsOpen} />
      
      <style>{`
        @keyframes marquee {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-100%, 0, 0); }
        }
        .og-promo-marquee {
          display: inline-block;
          padding-left: 100%;
          animation: marquee 25s linear infinite;
        }
        .og-promo-marquee:hover {
          animation-play-state: paused;
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes float-gentle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .animate-shimmer {
          background-size: 200% 100%;
          animation: shimmer 3s ease-in-out infinite;
        }
        .animate-float-gentle {
          animation: float-gentle 5s ease-in-out infinite;
        }
        .store-hero {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
          position: relative;
        }
        .store-hero::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -30%;
          width: 60%;
          height: 200%;
          background: radial-gradient(ellipse, rgba(99, 102, 241, 0.15) 0%, transparent 70%);
          pointer-events: none;
        }
        .store-hero::after {
          content: '';
          position: absolute;
          bottom: -40%;
          left: -20%;
          width: 50%;
          height: 180%;
          background: radial-gradient(ellipse, rgba(244, 63, 94, 0.1) 0%, transparent 70%);
          pointer-events: none;
        }
        .net-pill {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .net-pill:hover {
          transform: translateY(-2px);
        }
        .net-pill.active {
          transform: scale(1.05);
          box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }
      `}</style>
      
      <div className="relative z-10">
        {/* ── PROMO BANNER ── */}
        {agent.store_promo_banner && (
          <div className={`w-full py-3 overflow-hidden border-b flex items-center font-extrabold text-xs uppercase tracking-wider relative shadow-sm ${
            agent.store_promo_banner_style === 'midnight-gold' 
              ? 'bg-gradient-to-r from-stone-900 via-stone-950 to-stone-900 text-yellow-400 border-yellow-500/25'
              : agent.store_promo_banner_style === 'fire-ruby'
              ? 'bg-gradient-to-r from-rose-950 via-red-950 to-rose-950 text-rose-200 border-red-500/25'
              : agent.store_promo_banner_style === 'success-emerald'
              ? 'bg-gradient-to-r from-emerald-950 via-teal-950 to-emerald-950 text-emerald-300 border-emerald-500/25'
              : 'bg-gradient-to-r from-rose-950 via-indigo-950 to-rose-950 text-amber-300 border-indigo-500/25'
          }`}>
            <div className="og-promo-marquee whitespace-nowrap">
              {agent.store_promo_banner} &nbsp; &nbsp; • &nbsp; &nbsp; {agent.store_promo_banner} &nbsp; &nbsp; • &nbsp; &nbsp; {agent.store_promo_banner}
            </div>
          </div>
        )}

      <div className="mx-auto max-w-md px-4 pt-0 space-y-5 pb-24">
        
        {/* ══════════════════════════════════════════════════════════ */}
        {/* ── HERO BANNER — Full-width dark gradient with glow ── */}
        {/* ══════════════════════════════════════════════════════════ */}
        <div className="store-hero -mx-4 px-6 pt-10 pb-8 relative overflow-hidden">
          {/* Decorative ring */}
          <div className="absolute top-6 right-6 w-24 h-24 rounded-full border border-white/[0.06] pointer-events-none" />
          <div className="absolute top-10 right-10 w-14 h-14 rounded-full border border-white/[0.04] pointer-events-none" />
          
          {/* Notification Bell */}
          <div className="absolute top-6 right-6 z-20">
            <button 
              onClick={() => setNotificationsOpen(true)}
              className="relative h-10 w-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 h-3.5 w-3.5 bg-rose-500 rounded-full border-2 border-[#1e293b] flex items-center justify-center text-[8px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          <div className="relative z-10 space-y-5">
            {/* Logo + Name row */}
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-rose-500 p-[2px] shadow-xl shadow-indigo-500/20 animate-float-gentle flex-shrink-0">
                <div className="h-full w-full rounded-[14px] bg-slate-900 flex items-center justify-center">
                  <Store className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-extrabold text-white tracking-tight truncate">
                  {agent.store_name}
                </h1>
                <p className="text-sm text-slate-400 font-medium truncate">
                  {agent.store_tagline || "Fast data. Better prices."}
                </p>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
                </span>
                LIVE
              </span>
              <span className="text-[10px] font-bold text-slate-500 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 uppercase tracking-wider">
                Ghana · Reseller
              </span>
              <span className="text-[10px] font-medium text-slate-500 ml-auto">
                {currentTime || ""}
              </span>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* ── QUICK ACTIONS BAR ──                                  */}
        {/* ══════════════════════════════════════════════════════════ */}
        <div className="flex items-center gap-2 -mt-2">
          <button
            onClick={() => agent?.support_whatsapp && window.open(agent.support_whatsapp, '_blank')}
            className="flex items-center gap-1.5 flex-1 px-3 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <MessageCircle className="h-4 w-4" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-bold text-slate-800 dark:text-slate-200">Support</p>
              <p className="text-[8px] text-slate-400">Chat now</p>
            </div>
          </button>
          
          <button
            onClick={handleShareStore}
            className="flex items-center gap-1.5 flex-1 px-3 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="h-8 w-8 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center text-violet-600 dark:text-violet-400 group-hover:scale-110 transition-transform">
              <Share className="h-4 w-4" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-bold text-slate-800 dark:text-slate-200">Share</p>
              <p className="text-[8px] text-slate-400">Store link</p>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("trans")}
            className="flex items-center gap-1.5 flex-1 px-3 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
              <Clock className="h-4 w-4" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-bold text-slate-800 dark:text-slate-200">Track</p>
              <p className="text-[8px] text-slate-400">Status</p>
            </div>
          </button>
        </div>

        {/* ── CONDITIONAL RENDERING OF TABS ── */}

        {activeTab === "orders" && (
          <div className="space-y-6 animate-morph-in">

            {/* ══════════════════════════════════════════════════════ */}
            {/* ── NETWORK SELECTOR — Pill-style horizontal strip ── */}
            {/* ══════════════════════════════════════════════════════ */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Choose Network
                </h2>
                {selectedNetwork && (
                  <button 
                    onClick={() => { setSelectedNetwork(null); setSelectedBundle(null); }}
                    className="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white uppercase tracking-wider transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className="flex gap-2.5">
                {[
                  { id: "mtn", name: "MTN", bg: "bg-[#ffcc00]", text: "text-black", border: "border-[#e6b800]", ring: "ring-yellow-400/40" },
                  { id: "atigo", name: "AT", bg: "bg-[#4a148c]", text: "text-white", border: "border-[#380b6b]", ring: "ring-purple-400/40" },
                  { id: "telecel", name: "Telecel", bg: "bg-[#cc0000]", text: "text-white", border: "border-[#b30000]", ring: "ring-red-400/40" },
                ].map((net) => {
                  const isActive = selectedNetwork?.code.toLowerCase() === net.id || 
                    (selectedNetwork?.code.toLowerCase() === "at" && net.id === "atigo") ||
                    (selectedNetwork?.code.toLowerCase() === "airteltigo" && net.id === "atigo");
                  
                  return (
                    <button
                      key={net.id}
                      onClick={() => {
                        const matches = networks.find(
                          (n) => n.code.toLowerCase() === net.id ||
                            (n.code.toLowerCase() === "at" && net.id === "atigo") ||
                            (n.code.toLowerCase() === "airteltigo" && net.id === "atigo")
                        );
                        if (matches) {
                          setSelectedNetwork(matches);
                          setSelectedBundle(null);
                        }
                      }}
                      className={cn(
                        "net-pill flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 font-extrabold text-sm",
                        isActive 
                          ? cn(net.bg, net.text, net.border, "ring-2", net.ring, "active shadow-lg") 
                          : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-200 dark:hover:border-slate-700 shadow-sm"
                      )}
                    >
                      {net.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════ */}
            {/* ── BUNDLE GRID — Solid colored cards                ── */}
            {/* ══════════════════════════════════════════════════════ */}
            {selectedNetwork && (
              <div className="space-y-3 animate-morph-in">
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Select Bundle
                </h3>

                {loadingBundles ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-7 w-7 animate-spin text-slate-300" />
                  </div>
                ) : bundles.length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-10 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    No active bundles available.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {bundles.map((b, idx) => {
                      const active = selectedBundle?.id === b.id;
                      const isPopular = idx === 1 || idx === 4;
                      const sellPrice = priceFor(b);
                      const netStyle = getNetStyle(selectedNetwork.code);

                      return (
                        <button
                          type="button"
                          key={b.id}
                          onClick={() => {
                            setSelectedBundle(b);
                            setCheckoutOpen(true);
                          }}
                          className={cn(
                            "relative flex flex-col items-start rounded-2xl border px-4 py-4 text-left transition-all",
                            active ? netStyle.cardActive : netStyle.cardIdle
                          )}
                        >
                          {isPopular && !active && (
                            <span className="absolute -top-2 left-3 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground shadow-sm z-10">
                              Popular
                            </span>
                          )}

                          <div className="flex w-full justify-between items-start mb-5">
                            {selectedNetwork.code.toUpperCase() === 'MTN' ? (
                              <div className="flex items-center justify-center rounded-full border-[1.5px] border-black px-2 py-0.5 h-6">
                                <span className="text-[10px] font-black">MTN</span>
                              </div>
                            ) : selectedNetwork.code.toUpperCase() === 'TELECEL' ? (
                              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white">
                                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#cc0000]">
                                  <span className="text-[10px] font-bold text-white">t</span>
                                </div>
                              </div>
                            ) : (selectedNetwork.code.toUpperCase() === 'AIRTELTIGO' || selectedNetwork.code.toUpperCase() === 'AT') ? (
                              <div className="flex h-6 w-8 items-center justify-center rounded-md bg-gradient-to-r from-red-500 to-blue-500">
                                <span className="text-[10px] font-black text-white">AT</span>
                              </div>
                            ) : (
                              <div className="flex h-6 items-center justify-center">
                                <span className="text-[10px] font-black uppercase">{selectedNetwork.name}</span>
                              </div>
                            )}
                            
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-black/10">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                            </div>
                          </div>

                          <span className="text-3xl font-black leading-none tracking-tight">
                            {b.size_label}
                          </span>
                          <span className={cn("mt-1 text-xs font-medium opacity-80")}>
                            {selectedNetwork.name} Bundle
                          </span>
                          
                          <div className="mt-6 flex w-full items-end justify-between">
                            <span className={cn("text-xl font-black tracking-tight")}>
                              {formatGHS(sellPrice)}
                            </span>
                            <span className="text-[10px] font-semibold opacity-75">
                              1-5 min
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {activeTab === "trans" && (
          <div className="space-y-4 animate-morph-in">
            <div className={`p-5 rounded-[28px] shadow-sm space-y-2 ${getCardClass()}`}>
              <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">
                Track Order Status
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Enter your phone number below to view recent data purchase records and delivery status.
              </p>
              <div className="pt-2">
                <TrackOrder />
              </div>
            </div>
          </div>
        )}

        {activeTab === "bulk" && (
          <div className="space-y-4 animate-morph-in">
            <div className={`p-5 rounded-[28px] shadow-sm space-y-4 ${getCardClass()}`}>
              <div>
                <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">
                  Bulk Data Orders
                </h2>
                <p className="text-xs text-slate-400 font-medium">
                  Submit multiple data orders simultaneously. Ideal for companies or teams.
                </p>
              </div>

              <div className="space-y-3.5 border-t border-slate-100 dark:border-slate-800 pt-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Bulk Recipients (Phone, Size)</label>
                  <textarea
                    rows={4}
                    placeholder="e.g.&#10;0241234567, 5GB&#10;0501234567, 10GB"
                    className="w-full mt-1.5 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs focus:ring-rose-500"
                  />
                  <p className="text-[10px] text-slate-400 font-medium mt-1">One record per line. Separate phone and size with a comma.</p>
                </div>

                <Button
                  onClick={() => {
                    toast({
                      title: "Bulk Submission Received!",
                      description: "Our reseller system is reviewing your bulk request. Please complete payment.",
                    });
                  }}
                  className="w-full h-12 rounded-2xl font-bold bg-rose-500 hover:bg-rose-600 text-white transition-all shadow-md shadow-rose-500/10"
                >
                  <Layers className="mr-2 h-4 w-4" /> Submit Bulk Order
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "store" && (
          <div className="space-y-4 animate-morph-in">
            <div className={`p-6 rounded-[28px] shadow-sm space-y-4 ${getCardClass()}`}>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center">
                  <Store className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">
                    {agent.store_name}
                  </h2>
                  <p className="text-xs text-rose-500 font-bold uppercase tracking-wider">
                    RESELLER PARTNER STORE
                  </p>
                </div>
              </div>

              <div className="space-y-3.5 border-t border-slate-100 dark:border-slate-800 pt-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-800/40">
                  <span>Store Slug</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">/store/{slug}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-800/40">
                  <span>Activation Status</span>
                  <span className="text-emerald-500 font-extrabold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Fully Activated
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-800/40">
                  <span>Supported Regions</span>
                  <span className="text-slate-800 dark:text-slate-200">Ghana & Nigeria</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span>Support Channel</span>
                  <span className="text-slate-800 dark:text-slate-200">WhatsApp & Phone Call</span>
                </div>
                {isOwner && (
                  <div className="flex justify-between items-center py-3 mt-2 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-white block">Draggable WhatsApp Widget</span>
                      <span className="text-[10px] text-slate-400">Show floating support button to customers</span>
                    </div>
                    <button
                      onClick={toggleWidget}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${widgetEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${widgetEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "wallet" && (
          <div className="space-y-4 animate-morph-in">
            <WalletManager />
          </div>
        )}

      </div>

      {/* Subtle Agent Login Button for public view */}
      {!isOwner && (
        <div className="mt-12 mb-8 flex justify-center">
          <button
            onClick={() => setLoginOpen(true)}
            className="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 uppercase tracking-widest flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-all"
          >
            <Lock className="h-3 w-3" /> Agent Access
          </button>
        </div>
      )}

      {/* ── CHECKOUT CONFIRM DIALOG ── */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="w-[94vw] max-w-sm rounded-[32px] border-slate-100 dark:border-slate-800 p-0 overflow-hidden bg-white dark:bg-slate-900">
          
          {/* Top header strip */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white px-6 py-5 border-b border-slate-800/40 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-24 h-24 rounded-full bg-rose-500/10 blur-xl pointer-events-none" />
            <DialogHeader>
              <DialogTitle className="text-left text-lg font-black text-white flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-yellow-400 fill-yellow-400/20" /> Confirm Order
              </DialogTitle>
              <DialogDescription className="text-left text-xs text-slate-400">
                Please review purchase details before paying.
              </DialogDescription>
            </DialogHeader>

            {selectedBundle && selectedNetwork && (
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 px-4 py-3 backdrop-blur-sm">
                <div>
                  <p className="text-[10px] text-slate-400 font-extrabold uppercase">{selectedNetwork.name} bundle</p>
                  <p className="text-2xl font-black leading-tight text-white">
                    {selectedBundle.size_label}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 font-extrabold uppercase">Total</p>
                  <p className="text-2xl font-black text-rose-400">{formatGHS(finalPrice)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Checkout inputs */}
          <div className="space-y-4 px-6 py-5">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400">
                  Recipient Phone (Who is receiving the data?)
                </label>
                {isOwner && crmCustomers && crmCustomers.length > 0 && (
                  <select 
                    className="text-[10px] font-bold text-rose-500 bg-transparent outline-none cursor-pointer border-b border-rose-200 dark:border-rose-900/50 appearance-none pb-0.5"
                    onChange={(e) => {
                      if (e.target.value) setPhone(e.target.value);
                    }}
                  >
                    <option value="">Select from Address Book</option>
                    {crmCustomers.map((c: any) => (
                      <option key={c.id} value={c.phone}>{c.name} ({c.phone})</option>
                    ))}
                  </select>
                )}
              </div>
              <Input
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="024 123 4567"
                className="h-12 rounded-2xl border-slate-100 dark:border-slate-800 text-base font-semibold focus-visible:ring-rose-500"
              />
              <p className="mt-1 text-[9px] text-slate-400 font-medium">
                Data bundle will be automatically credited to this number.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">
                Payment Mobile Money Number (Who is paying?)
              </label>
              <div className="flex gap-2">
                <select 
                  className="w-[100px] h-12 rounded-2xl border-slate-100 dark:border-slate-800 text-sm font-semibold focus-visible:ring-rose-500 bg-white dark:bg-slate-900 px-3 border outline-none"
                  value={momoNetwork}
                  onChange={(e) => setMomoNetwork(e.target.value)}
                >
                  <option value="MTN">MTN</option>
                  <option value="TELECEL">Telecel</option>
                  <option value="AIRTELTIGO">AT</option>
                </select>
                <Input
                  inputMode="tel"
                  value={momoNumber}
                  onChange={(e) => setMomoNumber(e.target.value)}
                  placeholder="024 123 4567"
                  className="flex-1 h-12 rounded-2xl border-slate-100 dark:border-slate-800 text-base font-semibold focus-visible:ring-rose-500"
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-400 font-medium">
                The prompt will be sent to this number.
              </p>
              {isVerifying && (
                <div className="mt-2 text-xs text-rose-500 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
                  Verifying account...
                </div>
              )}
              {accountName && !isVerifying && (
                <div className="mt-2 text-xs font-semibold px-3 py-2 bg-emerald-500/10 text-emerald-600 rounded-lg flex items-center gap-2 border border-emerald-500/20">
                  <CheckCircle2 className="h-4 w-4" />
                  {accountName}
                </div>
              )}
            </div>

            {/* Promo / Discount Section */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
              <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">
                Promo Code or Gift Voucher
              </label>
              {appliedCoupon ? (
                <div className="flex items-center justify-between px-3 py-2 bg-rose-500/10 text-rose-500 rounded-2xl border border-rose-500/20 text-xs font-bold">
                  <div className="flex items-center gap-1.5">
                    <Gift className="h-4 w-4 text-rose-500" />
                    <span>Applied: <span className="font-mono text-slate-800 dark:text-white uppercase">{appliedCoupon.code}</span> (-GH₵ {Number(appliedCoupon.discount_amount).toFixed(2)})</span>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setAppliedCoupon(null);
                      setCouponCodeInput("");
                    }}
                    className="h-6 px-1.5 text-[10px] text-rose-500 hover:text-rose-600 font-extrabold"
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. WELCOME5"
                    value={couponCodeInput}
                    onChange={(e) => setCouponCodeInput(e.target.value)}
                    className="flex-1 h-11 rounded-2xl border-slate-100 dark:border-slate-800 text-sm font-semibold uppercase focus-visible:ring-rose-500"
                  />
                  <Button
                    onClick={applyCouponCode}
                    disabled={isCheckingCoupon || !couponCodeInput.trim()}
                    className="h-11 rounded-2xl px-4 text-xs font-bold bg-slate-950 hover:bg-slate-900 text-white dark:bg-slate-800 dark:hover:bg-slate-700"
                  >
                    {isCheckingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                  </Button>
                </div>
              )}
              {couponError && (
                <p className="mt-1 text-[10px] text-red-500 font-bold">{couponError}</p>
              )}
            </div>

            {/* 🔄 Momo Subscription (Recurring Delivery) */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="auto-bill-checkbox"
                    checked={subscribeChecked}
                    onChange={(e) => setSubscribeChecked(e.target.checked)}
                    className="mt-1 h-4.5 w-4.5 rounded border-slate-300 dark:border-slate-700 text-rose-500 focus:ring-rose-500"
                  />
                  <label htmlFor="auto-bill-checkbox" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    Auto-Pilot recurring topup 🔄
                    <span className="block text-[9px] text-slate-400 font-medium mt-0.5">
                      Automatically auto-deliver this bundle and bill my mobile money wallet. Cancel anytime.
                    </span>
                  </label>
                </div>
              </div>

              {subscribeChecked && (
                <div className="flex gap-2 p-1.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 animate-in fade-in duration-300">
                  {(["weekly", "monthly"] as const).map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => setSubscriptionFrequency(freq)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                        subscriptionFrequency === freq
                          ? "bg-rose-500 text-white shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      Every {freq === "weekly" ? "Week" : "Month"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              onClick={initiatePayment}
              disabled={
                !selectedBundle ||
                phone.replace(/\D/g, "").length < 9 ||
                momoNumber.replace(/\D/g, "").length < 9 ||
                isVerifying
              }
              className="h-12 w-full rounded-2xl text-xs font-black uppercase bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white shadow-md shadow-rose-500/10 transition-all duration-300"
            >
              <Zap className="mr-1.5 h-3.5 w-3.5 fill-current" /> Pay {selectedBundle ? formatGHS(finalPrice) : ""}
            </Button>

            <div className="flex items-center justify-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              <Lock className="h-3.5 w-3.5 text-slate-500" />
              Secured Payments · PCI-DSS Certified
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── GENERAL INFO POPUP (Quick Actions Dialog) ── */}
      {infoPopup && (
        <Dialog open={infoPopup.open} onOpenChange={(open) => setInfoPopup(open ? infoPopup : null)}>
          <DialogContent className="w-[94vw] max-w-sm rounded-[32px] border-slate-100 dark:border-slate-800 p-5 bg-white dark:bg-slate-900 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20">
                <Sparkles className="h-5 w-5" />
              </div>
              <DialogHeader>
                <DialogTitle className="text-left text-base font-black text-slate-800 dark:text-white">
                  {infoPopup.title}
                </DialogTitle>
              </DialogHeader>
            </div>
            
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
              {infoPopup.content}
            </p>

            <Button
              onClick={() => setInfoPopup(null)}
              className="w-full h-11 rounded-2xl font-bold bg-slate-950 hover:bg-slate-900 text-white text-xs dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              Understand
            </Button>
          </DialogContent>
        </Dialog>
      )}

      {/* Floating Widget */}
      {widgetEnabled && agent?.support_whatsapp && (
        <DraggableWidget initialPosition={{ x: window.innerWidth - 80, y: window.innerHeight - 300 }}>
          <DraggableWhatsApp link={agent.support_whatsapp} />
        </DraggableWidget>
      )}

      {/* Agent Login Modal */}
      {loginOpen && (
        <AgentLogin storeName={agent?.store_name || "Agent Store"} onClose={() => setLoginOpen(false)} />
      )}

      {/* 🎮 Loyalty Rewards Hub Floating Button & Dialog */}
      {agent?.enable_loyalty_rewards !== false && (
        <DraggableWidget initialPosition={{ x: 24, y: window.innerHeight - 150 }}>
          <button
            onClick={() => setLoyaltyOpen(true)}
            className="h-14 w-14 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 border border-amber-400/20"
          >
            <Trophy className="h-6 w-6 animate-bounce" />
          </button>
        </DraggableWidget>
      )}

      <Dialog open={loyaltyOpen} onOpenChange={setLoyaltyOpen}>
        <DialogContent className="w-[94vw] max-w-sm rounded-[32px] border-slate-100 dark:border-slate-800 p-6 bg-white dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
              <Trophy className="h-6 w-6" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-left text-lg font-black text-slate-800 dark:text-white">
                Loyalty Rewards Hub
              </DialogTitle>
              <DialogDescription className="text-left text-xs text-slate-400">
                Earn GigPoints on every purchase and redeem checkout discounts!
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                Enter your phone number to check balance:
              </label>
              <div className="flex gap-2">
                <Input
                  inputMode="tel"
                  placeholder="024 123 4567"
                  value={loyaltyPhone}
                  onChange={(e) => setLoyaltyPhone(e.target.value)}
                  className="flex-1 h-11 rounded-xl border-slate-100 dark:border-slate-800 text-sm font-semibold"
                />
                <Button
                  onClick={checkLoyaltyPoints}
                  disabled={isCheckingLoyalty || !loyaltyPhone.trim()}
                  className="h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs"
                >
                  {isCheckingLoyalty ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
                </Button>
              </div>
            </div>

            {loyaltyPointsBalance !== null && (
              <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 text-center space-y-2 animate-in fade-in duration-300">
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Your Balance</p>
                <p className="text-3xl font-black text-amber-500">{loyaltyPointsBalance} <span className="text-xs font-bold text-slate-400">GigPoints</span></p>
                
                {loyaltyPointsBalance >= 10 ? (
                  <div className="pt-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                      Redeem 10 points for GH₵ 1.00 off! (Max discount: bundle price minus GH₵ 1.00)
                    </p>
                    <Button
                      onClick={redeemLoyaltyPoints}
                      className="w-full h-10 rounded-xl bg-slate-950 hover:bg-slate-900 text-white dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-extrabold"
                    >
                      Redeem Discount Now
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 font-medium pt-1">
                    You need at least 10 points to redeem a discount.
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 🤖 AI Storefront Assistant Widget */}
      {agent?.enable_ai_assistant !== false && (
        <DraggableWidget initialPosition={{ x: window.innerWidth - 340, y: window.innerHeight - 150 }}>
          <div className="flex flex-col items-end">
            {aiOpen && (
              <div className="mb-4 w-80 h-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white p-4 flex items-center justify-between shadow-md">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                      <Sparkles className="h-4 w-4 text-yellow-300 fill-yellow-300" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm leading-tight">Storefront AI</h3>
                      <p className="text-[10px] text-indigo-200">Online & Ready</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setAiOpen(false)}
                    className="h-7 w-7 p-0 rounded-full hover:bg-white/10 text-white hover:text-white"
                  >
                    ✕
                  </Button>
                </div>
                {/* Messages */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50 dark:bg-slate-950/50">
                  {chatMessages.map((m, idx) => (
                    <div key={idx} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-xs font-semibold leading-relaxed shadow-sm ${
                        m.sender === "user" 
                          ? "bg-indigo-600 text-white rounded-tr-none" 
                          : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-none"
                      }`}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Input */}
                <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex gap-2 bg-white dark:bg-slate-900">
                  <Input
                    placeholder="Ask me anything..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    className="h-10 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border-none focus-visible:ring-indigo-500"
                  />
                  <Button 
                    onClick={handleSendMessage}
                    className="h-10 rounded-xl px-4 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            
            {/* Toggle Button */}
            <button
              onClick={() => setAiOpen(!aiOpen)}
              className="h-14 w-14 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 border border-violet-500/20"
            >
              <MessageCircle className="h-6 w-6 animate-pulse" />
            </button>
          </div>
        </DraggableWidget>
      )}

    </div>
    </div>
  );
}
