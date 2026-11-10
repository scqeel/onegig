import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Clock, Loader2, Lock, MessageCircle, Settings, ShoppingBag, Store, Trophy, Wallet, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNetworks, useBundles, BundleRow, NetworkRow } from "@/hooks/useNetworksAndBundles";
import { useSettings } from "@/hooks/useSettings";
import { useStoreBranding } from "@/hooks/useStoreBranding";
import { TrackOrder } from "@/components/buy/TrackOrder";
import { BundleCard } from "@/components/buy/BundleCard";
import { DraggableWhatsApp } from "@/components/agent/DraggableWhatsApp";
import { DraggableWidget } from "@/components/agent/DraggableWidget";
import { AgentLogin } from "@/components/agent/AgentLogin";
import { CustomerWallet } from "@/components/store/CustomerWallet";
import { StorefrontNotificationsModal } from "@/components/store/StorefrontNotificationsModal";
import { StoreHeader, StorePromoBanner } from "@/components/store/StoreHeader";
import { StoreInfoPanel } from "@/components/store/StoreInfoPanel";
import { StorePaymentStatus } from "@/components/store/StorePaymentStatus";
import { CheckoutDialog } from "@/components/store/CheckoutDialog";
import { RewardsDialog } from "@/components/store/RewardsDialog";
import { StoreAssistant } from "@/components/store/StoreAssistant";
import { StatusRibbon } from "@/components/shared/StatusRibbon";
import { PillTab, PillTabs } from "@/components/shared/PillTabs";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { formatGHS } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tab = "orders" | "trans" | "store";
type CategoryFilter = "all" | "non-expiry" | "monthly";
type Phase = "select" | "processing" | "otp" | "polling" | "delivering" | "success" | "error";

const STORE_TABS: PillTab<Tab>[] = [
  { value: "orders", label: "Buy", icon: <ShoppingBag className="h-4 w-4" /> },
  { value: "trans", label: "Track", icon: <Clock className="h-4 w-4" /> },
  { value: "store", label: "Store", icon: <Store className="h-4 w-4" /> },
];

const CATEGORY_TABS: PillTab<CategoryFilter>[] = [
  { value: "all", label: "All" },
  { value: "non-expiry", label: "Non-Expiry" },
  { value: "monthly", label: "Regular/Monthly" },
];

const STORE_NETWORKS = [
  { id: "mtn", name: "MTN", active: "border-[#e6b800] bg-[#ffcc00] text-black", codes: ["mtn"] },
  { id: "atigo", name: "AT", active: "border-[#380b6b] bg-[#4a148c] text-white", codes: ["atigo", "at", "airteltigo"] },
  { id: "telecel", name: "Telecel", active: "border-[#b30000] bg-[#cc0000] text-white", codes: ["telecel"] },
];

const STORE_COLUMNS =
  "id, user_id, store_name, store_slug, store_logo_url, store_tagline, store_brand_color, store_font_family, store_dark_mode, store_promo_banner, store_promo_banner_style, support_whatsapp, activation_paid";
// Not in the generated database types, so these may not exist on every database yet.
const STORE_OPTIONAL_COLUMNS = "enable_loyalty_rewards, enable_ai_assistant";

const RIBBON_ACTION =
  "flex items-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3.5 py-2 text-xs font-semibold text-muted-foreground shadow-sm transition-all hover:text-foreground active:scale-95";

export default function AgentStorePage({ customDomainSlug }: { customDomainSlug?: string }) {
  const { slug: routeSlug } = useParams<{ slug: string }>();
  const slug = customDomainSlug || routeSlug;
  const nav = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [walletBalance, setWalletBalance] = useState(0);
  const { data: settings } = useSettings();
  const activeGateway = settings?.active_payment_gateway || "paystack";
  console.log("[AgentStore] activeGateway resolved to:", activeGateway);

  // Navigation & Theme tabs
  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const [loginOpen, setLoginOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Order state
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkRow | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<BundleRow | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [momoNumber, setMomoNumber] = useState("");
  const [momoNetwork, setMomoNetwork] = useState<string>("MTN");
  const [email, setEmail] = useState(profile?.email || "");
  const [phase, setPhase] = useState<Phase>("select");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [otpTimer, setOtpTimer] = useState(0);

  // Countdown timer for OTP resend
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [otpTimer]);

  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [payWithWallet, setPayWithWallet] = useState(false);

  // Promo Coupon Code States
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);

  // 1. Fetch Agent Profile
  const { data: agent, isLoading: loadingAgent, isError } = useQuery({
    queryKey: ["public-store", slug],
    enabled: !!slug,
    queryFn: async () => {
      const load = (columns: string) =>
        supabase
          .from("agent_profiles")
          .select(columns)
          .eq("store_slug", slug!)
          .eq("activation_paid", true)
          .maybeSingle();

      // A missing optional column must not take the whole store offline.
      const withOptional = await load(`${STORE_COLUMNS}, ${STORE_OPTIONAL_COLUMNS}`);
      const { data } = withOptional.error ? await load(STORE_COLUMNS) : withOptional;
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

  const isOwner = !!profile && profile.id === agent?.user_id;

  useStoreBranding({
    brandColor: agent?.store_brand_color,
    font: agent?.store_font_family,
    forceDark: agent?.store_dark_mode,
  });

  // Fetch Agent's CRM customers if they are the owner
  const { data: crmCustomers } = useQuery({
    queryKey: ["agent-crm-customers", agent?.id],
    enabled: !!isOwner && !!agent?.id,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return []; // Session expired, don't throw 401
      
      const { data, error } = await supabase.functions.invoke("crm-manage", {
        body: { action: "list" },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      if (error) throw error;
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
      const { data: points, error } = await (supabase.rpc as any)("get_loyalty_points", {
        phone_number: clean,
        agent_uuid: agent.id
      });

      if (error) {
        toast({ title: "Failed to check points", description: error.message, variant: "destructive" });
        setIsCheckingLoyalty(false);
        return;
      }

      if (!points || Number(points) === 0) {
        toast({ title: "No loyalty history", description: "You don't have any purchase history on this store yet.", variant: "destructive" });
        setLoyaltyPointsBalance(0);
        setIsCheckingLoyalty(false);
        return;
      }

      setLoyaltyPointsBalance(Number(points));
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

  // Widget settings
  const [widgetEnabled, setWidgetEnabled] = useState(() => {
    return localStorage.getItem("og_whatsapp_widget") !== "false";
  });

  const toggleWidget = () => {
    const newState = !widgetEnabled;
    setWidgetEnabled(newState);
    localStorage.setItem("og_whatsapp_widget", String(newState));
  };


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

      const { data, error } = await supabase.functions.invoke(`${activeGateway}-verify`, {
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
    return <LoadingScreen message="Loading Storefront..." submessage="Fetching agent packages & storefront details" />;
  }

  // Helper to get sell price
  const priceFor = (b: BundleRow) =>
    priceOverrides && priceOverrides[b.id] != null
      ? priceOverrides[b.id]
      : Number(b.user_price ?? b.base_price ?? 0);

  const baseFinalPrice = selectedBundle ? priceFor(selectedBundle) : 0;
  const priceAfterCoupon = appliedCoupon
    ? Math.max(0, baseFinalPrice - Number(appliedCoupon.discount_amount))
    : baseFinalPrice;
  const finalPrice = Math.max(1, priceAfterCoupon - pointsRedeemed);

  // Checkout flow
  const initiatePayment = async () => {
    if (!selectedBundle || !phone || phone.replace(/\D/g, "").length < 9) {
      toast({ title: "Enter recipient phone", variant: "destructive" });
      return;
    }

    if (!payWithWallet && activeGateway === "theteller") {
      return payWithRedirect();
    }

    if (!payWithWallet && (!momoNumber || momoNumber.replace(/\D/g, "").length < 9)) {
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
      if (payWithWallet) {
        const { data, error } = await supabase.functions.invoke("wallet-pay", {
          body: {
            bundle_id: selectedBundle.id,
            recipient_phone: phone.replace(/\D/g, ""),
            agent_slug: slug ?? null,
          },
        });

        if (error || !data?.ok) {
          const errPayload = data?.error || error?.message || "Wallet payment failed";
          const errMsg = typeof errPayload === "object" ? JSON.stringify(errPayload) : errPayload;
          setErrorMsg(errMsg);
          setPhase("error");
          return;
        }

        setPhase("success");
        window.dispatchEvent(new Event('wallet-updated'));
        return;
      }


      const { data, error } = await supabase.functions.invoke(`${activeGateway}-process`, {
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
      const { data, error } = await supabase.functions.invoke(`${activeGateway}-process`, {
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

  const payWithRedirect = async () => {
    if (!settings) {
      toast({ title: "Loading settings", description: "Payment configuration is still loading. Please try again in a moment.", variant: "destructive" });
      return;
    }
    if (!selectedBundle || !phone || phone.replace(/\D/g, "").length < 9) {
      toast({ title: "Enter recipient phone", variant: "destructive" });
      return;
    }

    setCheckoutOpen(false);
    setPhase("processing");
    setAuthMessage("Preparing secure checkout page...");

    try {
      const { data, error } = await supabase.functions.invoke(`${activeGateway}-initiate`, {
        body: {
          purpose: "order",
          recipient_phone: phone.replace(/\D/g, ""),
          bundle_id: selectedBundle.id,
          agent_slug: slug ?? null,
          email: email || "guest@mtopup.shop",
          return_url: window.location.origin + `/track`,
          momo_number: momoNumber,
        },
      });

      if (error || !data?.ok) {
        setPhase("error");
        setErrorMsg(data?.error || error?.message || "Failed to initialize secure checkout page");
        return;
      }

      setAuthMessage(`Redirecting to ${activeGateway === "theteller" ? "theTeller" : "Paystack"}...`);
      window.location.href = data.authorization_url;
    } catch (e: any) {
      setPhase("error");
      setErrorMsg(e?.message || "An unexpected error occurred.");
    }
  };

  const resendPaymentOtp = async () => {
    if (!settings) {
      toast({ title: "Loading settings", description: "Payment configuration is still loading. Please try again in a moment.", variant: "destructive" });
      return;
    }
    if (otpTimer > 0) return;
    setPhase("processing");
    try {
      const { data, error } = await supabase.functions.invoke(`${activeGateway}-process`, {
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

  const handleOtpChange = (value: string) => {
    setOtp(value);
    if (value.length === 6 && phase === "otp") submitOtp(value);
  };

  const backToStore = () => {
    setPhase("select");
    setOtp("");
    setAuthMessage(null);
  };

  if (phase !== "select") {
    return (
      <StorePaymentStatus
        phase={phase}
        phone={phone}
        momoNumber={momoNumber}
        momoNetwork={momoNetwork}
        bundleLabel={selectedBundle?.size_label}
        networkName={selectedNetwork?.name}
        amount={formatGHS(finalPrice)}
        paidWithWallet={payWithWallet}
        reference={orderRef}
        authMessage={authMessage}
        errorMsg={errorMsg}
        otp={otp}
        otpTimer={otpTimer}
        onOtpChange={handleOtpChange}
        onSubmitOtp={() => submitOtp()}
        onResendOtp={resendPaymentOtp}
        onCancel={backToStore}
        onPayWithRedirect={payWithRedirect}
        onReturnToStore={() => setPhase("select")}
        onTrack={() => {
          const ref = orderRef || phone.replace(/\D/g, "");
          setPhase("select");
          setActiveTab("trans");
          nav(`?ref=${encodeURIComponent(ref)}`, { replace: true });
        }}
      />
    );
  }

  const visibleBundles = bundles.filter((b) => {
    const label = b.size_label.toLowerCase();
    const isNonExpiry = label.includes("non-expiry") || label.includes("no-expiry");
    if (categoryFilter === "non-expiry") return isNonExpiry;
    if (categoryFilter === "monthly") return !isNonExpiry;
    return true;
  });

  const rewardsEnabled = agent.enable_loyalty_rewards !== false;
  const storeInfoPanel = (
    <StoreInfoPanel
      name={agent.store_name}
      logoUrl={agent.store_logo_url}
      storeAddress={customDomainSlug ? window.location.hostname : `/store/${slug}`}
      hasSupport={!!agent.support_whatsapp}
      showWidgetToggle={isOwner}
      widgetEnabled={widgetEnabled}
      onToggleWidget={toggleWidget}
    />
  );

  return (
    <div className="relative min-h-dvh bg-background pb-24 text-foreground">
      {agent.store_promo_banner && (
        <StorePromoBanner text={agent.store_promo_banner} bannerStyle={agent.store_promo_banner_style} />
      )}

      <div className="mx-auto max-w-6xl space-y-4 px-3 py-4 md:space-y-5 md:px-6 md:py-5">
        <StoreHeader
          name={agent.store_name}
          tagline={agent.store_tagline}
          logoUrl={agent.store_logo_url}
          onNotifications={() => setNotificationsOpen(true)}
          onShare={handleShareStore}
        />

        <StatusRibbon
          icon={<Zap className="h-5 w-5" />}
          title="Live Store"
          subtitle={<span>Pay with MoMo. Your bundle is delivered automatically.</span>}
          actions={
            <>
              {profile ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {isOwner ? "Agent Wallet" : "Store Balance"}
                  </span>
                  <CustomerWallet userId={profile.id} agentSlug={agent.store_slug} onBalanceChange={setWalletBalance} />
                </div>
              ) : (
                <button type="button" onClick={() => nav(`/store-auth/${slug}`)} className={RIBBON_ACTION}>
                  <Wallet className="h-3.5 w-3.5" /> Login & View Balance
                </button>
              )}
              {agent.support_whatsapp && (
                <button type="button" onClick={() => window.open(agent.support_whatsapp, "_blank")} className={RIBBON_ACTION}>
                  <MessageCircle className="h-3.5 w-3.5" /> Support
                </button>
              )}
              {rewardsEnabled && (
                <button type="button" onClick={() => setLoyaltyOpen(true)} className={RIBBON_ACTION}>
                  <Trophy className="h-3.5 w-3.5 text-amber-500" /> Rewards
                </button>
              )}
              {isOwner && !customDomainSlug && (
                <button type="button" onClick={() => nav("/agent")} className={RIBBON_ACTION}>
                  <Settings className="h-3.5 w-3.5" /> Manage store
                </button>
              )}
            </>
          }
        />

        <div className="sticky top-2 z-20">
          <PillTabs
            tabs={STORE_TABS}
            value={activeTab}
            onChange={setActiveTab}
            stretch
            className="bg-card shadow-soft"
            tabClassName="py-2"
          />
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px] xl:gap-5">
          <main className={cn("min-w-0 space-y-5 animate-in fade-in duration-300", activeTab === "store" && "lg:col-span-2")}>
            {activeTab === "orders" && (
              <>
                <section className="space-y-3">
                  <h2 className="text-lg font-bold text-foreground">Choose Network</h2>
                  <div className="flex gap-2.5">
                    {STORE_NETWORKS.map((net) => {
                      const isActive = net.codes.includes(selectedNetwork?.code.toLowerCase() ?? "");
                      return (
                        <button
                          key={net.id}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => {
                            const match = networks.find((n) => net.codes.includes(n.code.toLowerCase()));
                            if (match) {
                              setSelectedNetwork(match);
                              setSelectedBundle(null);
                            }
                          }}
                          className={cn(
                            "flex flex-1 items-center justify-center rounded-xl border py-3 text-sm font-bold shadow-soft transition-all active:scale-95",
                            isActive ? net.active : "border-border bg-card text-foreground hover:border-primary/40",
                          )}
                        >
                          {net.name}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {selectedNetwork && (
                  <section className="space-y-3 animate-in fade-in duration-300">
                    <h2 className="text-lg font-bold text-foreground">Select Bundle</h2>

                    {loadingBundles ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                      </div>
                    ) : bundles.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border bg-card py-10 text-center text-xs text-muted-foreground">
                        No active bundles available.
                      </div>
                    ) : (
                      <>
                        <PillTabs
                          tabs={CATEGORY_TABS}
                          value={categoryFilter}
                          onChange={setCategoryFilter}
                          stretch
                          className="max-w-sm"
                          tabClassName="py-1.5"
                        />

                        {visibleBundles.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-border bg-card py-10 text-center text-xs text-muted-foreground">
                            No bundles match the selected category.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                            {visibleBundles.map((b, idx) => (
                              <BundleCard
                                key={b.id}
                                networkCode={selectedNetwork.code}
                                networkName={selectedNetwork.name}
                                sizeLabel={b.size_label}
                                price={formatGHS(priceFor(b))}
                                active={selectedBundle?.id === b.id}
                                badge={
                                  idx === 1 || idx === 4
                                    ? "popular"
                                    : idx === bundles.length - 1 && bundles.length > 2
                                      ? "best"
                                      : undefined
                                }
                                onClick={() => {
                                  setSelectedBundle(b);
                                  setCheckoutOpen(true);
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </section>
                )}
              </>
            )}

            {activeTab === "trans" && (
              <div className="space-y-3">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Track Order Status</h2>
                  <p className="text-xs text-muted-foreground">
                    Enter your phone number below to view recent data purchase records and delivery status.
                  </p>
                </div>
                <TrackOrder />
              </div>
            )}

            {activeTab === "store" && storeInfoPanel}
          </main>

          {activeTab !== "store" && <aside className="hidden lg:sticky lg:top-16 lg:block">{storeInfoPanel}</aside>}
        </div>

        {!isOwner && (
          <div className="flex justify-center pt-8">
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
            >
              <Lock className="h-3 w-3" /> Agent Access
            </button>
          </div>
        )}
      </div>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        bundleLabel={selectedBundle?.size_label}
        networkName={selectedNetwork?.name}
        networkCode={selectedNetwork?.code}
        bundlePrice={baseFinalPrice}
        finalPrice={finalPrice}
        hasBundle={!!selectedBundle}
        phone={phone}
        onPhoneChange={setPhone}
        crmCustomers={isOwner ? crmCustomers : undefined}
        momoNumber={momoNumber}
        onMomoNumberChange={setMomoNumber}
        momoNetwork={momoNetwork}
        onMomoNetworkChange={setMomoNetwork}
        isVerifying={isVerifying}
        accountName={accountName}
        couponCodeInput={couponCodeInput}
        onCouponCodeInputChange={setCouponCodeInput}
        appliedCoupon={appliedCoupon}
        couponError={couponError}
        isCheckingCoupon={isCheckingCoupon}
        onApplyCoupon={applyCouponCode}
        onRemoveCoupon={() => {
          setAppliedCoupon(null);
          setCouponCodeInput("");
        }}
        subscribeChecked={subscribeChecked}
        onSubscribeCheckedChange={setSubscribeChecked}
        subscriptionFrequency={subscriptionFrequency}
        onSubscriptionFrequencyChange={setSubscriptionFrequency}
        canPayWithWallet={!!profile && walletBalance > 0 && walletBalance >= finalPrice}
        payWithWallet={payWithWallet}
        onPayWithWalletChange={setPayWithWallet}
        walletBalanceLabel={formatGHS(walletBalance)}
        onPay={initiatePayment}
      />

      <RewardsDialog
        open={loyaltyOpen}
        onOpenChange={setLoyaltyOpen}
        phone={loyaltyPhone}
        onPhoneChange={setLoyaltyPhone}
        pointsBalance={loyaltyPointsBalance}
        isChecking={isCheckingLoyalty}
        onCheck={checkLoyaltyPoints}
        onRedeem={redeemLoyaltyPoints}
      />

      {/* The floating buttons sit above dialogs, so hide them while the Pay button is on screen. */}
      {!checkoutOpen && widgetEnabled && agent.support_whatsapp && (
        <DraggableWidget initialPosition={{ x: window.innerWidth - 80, y: window.innerHeight - 300 }}>
          <DraggableWhatsApp link={agent.support_whatsapp} />
        </DraggableWidget>
      )}

      {!checkoutOpen && agent.enable_ai_assistant !== false && (
        <DraggableWidget initialPosition={{ x: Math.max(8, window.innerWidth - 340), y: window.innerHeight - 150 }}>
          <StoreAssistant
            open={aiOpen}
            onOpenChange={setAiOpen}
            messages={chatMessages}
            input={chatInput}
            onInputChange={setChatInput}
            onSend={handleSendMessage}
          />
        </DraggableWidget>
      )}

      {loginOpen && <AgentLogin storeName={agent.store_name || "Agent Store"} onClose={() => setLoginOpen(false)} />}

      <StorefrontNotificationsModal open={notificationsOpen} onOpenChange={setNotificationsOpen} />
    </div>
  );
}
