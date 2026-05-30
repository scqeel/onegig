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
import { OwnerDashboard } from "@/components/agent/OwnerDashboard";
import { AgentLogin } from "@/components/agent/AgentLogin";
import { formatGHS } from "@/lib/format";
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

export default function AgentStorePage() {
  const { slug } = useParams<{ slug: string }>();
  const nav = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();

  // Navigation & Theme tabs
  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const [accent, setAccent] = useState<ThemeAccent>("rose");
  const [currentTime, setCurrentTime] = useState("");
  const [viewMode, setViewMode] = useState<"storefront" | "dashboard">("dashboard");
  const [loginOpen, setLoginOpen] = useState(false);

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

  // Dialog / Info popup states
  const [infoPopup, setInfoPopup] = useState<{ open: boolean; title: string; content: string } | null>(null);

  // Widget settings
  const [widgetEnabled, setWidgetEnabled] = useState(() => {
    return localStorage.getItem("og_whatsapp_widget") !== "false";
  });

  const toggleWidget = () => {
    const newState = !widgetEnabled;
    setWidgetEnabled(newState);
    localStorage.setItem("og_whatsapp_widget", String(newState));
  };

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

  // Helper to get sell price
  const priceFor = (b: BundleRow) =>
    priceOverrides && priceOverrides[b.id] != null
      ? priceOverrides[b.id]
      : Number(b.user_price ?? b.base_price);

  const finalPrice = selectedBundle ? priceFor(selectedBundle) : 0;

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

  return (
    <div className="min-h-dvh bg-[#f8fafc] dark:bg-slate-950 pb-24 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <div className="mx-auto max-w-md px-4 pt-4 space-y-4">
        
        {/* ── CARD HEADER (Premium Dark-Glassmorphism) ── */}
        <div className="bg-gradient-to-br from-[#0b132b] via-[#1c2541] to-[#0d1b2a] text-white rounded-[32px] p-6 shadow-xl relative overflow-hidden transition-all duration-500">
          
          {/* Neon gradient highlights */}
          <div className="absolute right-0 top-0 w-44 h-44 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
          <div className="absolute left-1/3 bottom-0 w-36 h-36 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />
          <div className="absolute -left-10 -top-10 w-24 h-24 rounded-full bg-pink-500/10 blur-xl pointer-events-none" />

          {/* Profile details */}
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                {agent.store_name}
                <Sparkles className="h-5 w-5 text-yellow-400 fill-yellow-400/20 animate-pulse" />
              </h1>
              <p className="text-sm text-slate-300 font-medium">
                {agent.store_tagline || "Welcome to Mtopup"}
              </p>
              <div className="pt-2">
                <span className="inline-block text-[9px] font-extrabold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
                  GHANA · RESELLER PLATFORM
                </span>
              </div>
            </div>

            {/* Custom Theme Switcher */}
            <button
              onClick={rotateAccent}
              title="Change Accent Color"
              className="bg-slate-800/60 text-slate-300 p-2.5 rounded-full hover:bg-slate-700/80 transition-all border border-slate-700/50 relative group"
            >
              <Paintbrush className="h-4.5 w-4.5 group-hover:rotate-12 transition-transform" />
              <span className="absolute -bottom-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
            </button>
          </div>

          {/* Header Action Grid (Tabs) - ONLY FOR STORE OWNER */}
          {isOwner && (
            <div className="grid grid-cols-5 gap-2 mt-6">
              {[
                { id: "orders", label: "Orders", icon: ShoppingBag },
                { id: "trans", label: "Trans", icon: Receipt },
                { id: "bulk", label: "Bulk", icon: Layers },
                { id: "store", label: "Store", icon: Store },
                { id: "wallet", label: "Wallet", icon: Wallet },
              ].map((t) => {
                const Icon = t.icon;
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as Tab | "wallet")}
                    className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300 border ${
                      active
                        ? "border-rose-500/40 bg-rose-500/15 text-white shadow-lg shadow-rose-500/5"
                        : "border-white/5 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                    }`}
                  >
                    <div
                      className={`h-8 w-8 rounded-xl flex items-center justify-center mb-1 transition-all ${
                        active ? "bg-rose-500 text-white" : "bg-white/5 text-rose-400"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-[9px] font-bold tracking-wide uppercase">{t.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── CONDITIONAL RENDERING OF TABS ── */}

        {activeTab === "orders" && (
          <div className="space-y-4 animate-morph-in">
            
            {/* System Status online bar */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 px-5 py-3.5 rounded-[24px] shadow-sm">
              <div className="flex items-center">
                <span className="relative flex h-3 w-3 mr-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">System Online</span>
                    <span className="bg-emerald-500 text-white font-extrabold text-[8px] px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                      24/7
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold">{currentTime || "12:26:36 AM"}</p>
                </div>
              </div>
              
              <div className="flex gap-1.5">
                {[Zap, Shield, Wifi].map((Icon, idx) => (
                  <div
                    key={idx}
                    className="h-8 w-8 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 flex items-center justify-center text-rose-500 shadow-sm"
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                ))}
              </div>
            </div>

            {/* Need Help Card */}
            <div
              onClick={() => agent?.support_whatsapp && window.open(agent.support_whatsapp, '_blank')}
              className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 p-4 rounded-[24px] shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all duration-300"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-100 dark:border-cyan-900/50 flex items-center justify-center text-cyan-500 shadow-sm">
                  <Headphones className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">Need Help?</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Chat with our support team</p>
                </div>
              </div>
              <div className="flex text-slate-300 dark:text-slate-700">
                <ChevronRight className="h-4 w-4" />
                <ChevronRight className="h-4 w-4 -ml-2" />
              </div>
            </div>

            {/* MTN / ATigo / Telecel selector */}
            <div id="place-new-order" className="space-y-3 pt-2">
              <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
                Place New Order
              </h2>

              <div className="grid grid-cols-4 gap-2.5">
                {[
                  {
                    id: "mtn",
                    name: "MTN",
                    logo: (
                      <div className="h-12 w-12 rounded-full bg-[#ffcc00] flex items-center justify-center border border-yellow-200 shadow-sm relative overflow-hidden scale-95">
                        <div className="border border-blue-900/60 rounded-full w-9 h-6 flex items-center justify-center bg-transparent">
                          <span className="text-[9px] font-extrabold text-blue-950 tracking-tighter">MTN</span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: "atigo",
                    name: "ATigo",
                    logo: (
                      <div className="h-12 w-12 rounded-xl bg-[#0f2f5f] flex flex-col justify-between items-center border border-blue-900 shadow-sm overflow-hidden p-1 relative scale-95">
                        <div className="flex-1 flex items-center justify-center">
                          <span className="text-xs font-extrabold text-white italic tracking-tighter">at</span>
                        </div>
                        <div className="w-full h-2 bg-[#e31a22] rounded-b-lg absolute bottom-0 left-0" />
                      </div>
                    ),
                  },
                  {
                    id: "telecel",
                    name: "Telecel",
                    logo: (
                      <div className="h-12 w-12 rounded-full bg-[#e30613] flex items-center justify-center border border-red-500 shadow-sm overflow-hidden scale-95">
                        <div className="h-6 w-6 rounded-full bg-white flex items-center justify-center">
                          <span className="text-[10px] font-extrabold text-[#e30613] tracking-tighter">t</span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: "check",
                    name: "Check...",
                    logo: (
                      <div className="h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center border border-emerald-200 dark:border-emerald-900/50 shadow-sm scale-95">
                        <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                      </div>
                    ),
                  },
                ].map((net) => {
                  const isCheck = net.id === "check";
                  const active = isCheck 
                    ? selectedNetwork === null && activeTab === "trans" 
                    : selectedNetwork?.code.toLowerCase() === net.id || (selectedNetwork?.code.toLowerCase() === "at" && net.id === "atigo");

                  return (
                    <button
                      key={net.id}
                      onClick={() => {
                        if (isCheck) {
                          setActiveTab("trans");
                        } else {
                          const matches = networks.find(
                            (n) =>
                              n.code.toLowerCase() === net.id ||
                              (n.code.toLowerCase() === "at" && net.id === "atigo")
                          );
                          if (matches) {
                            setSelectedNetwork(matches);
                            setSelectedBundle(null);
                          } else {
                            toast({ title: `Network ${net.name} not loaded.`, variant: "destructive" });
                          }
                        }
                      }}
                      className={`flex flex-col items-center p-3 rounded-[24px] bg-white dark:bg-slate-900 border transition-all duration-300 shadow-sm ${
                        active
                          ? `border-${accent}-500/60 dark:border-${accent}-500/60 ring-2 ring-${accent}-500/20`
                          : "border-slate-100 dark:border-slate-800/80 hover:border-slate-200 dark:hover:border-slate-800"
                      }`}
                      style={{
                        borderColor: active ? currentAccent.primary : undefined,
                        boxShadow: active ? `0 0 12px ${currentAccent.primary}15` : undefined
                      }}
                    >
                      {net.logo}
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-2">{net.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* BUNDLE LIST FOR SELECTED NETWORK */}
            {selectedNetwork && (
              <div className="rounded-[28px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4 animate-morph-in">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                      Select {selectedNetwork.name} Bundle
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">Select a bundle to place order</p>
                  </div>
                  <button 
                    onClick={() => setSelectedNetwork(null)}
                    className="text-[10px] font-extrabold text-rose-500 hover:underline uppercase"
                  >
                    Clear
                  </button>
                </div>

                {loadingBundles ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : bundles.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-4">No active bundles loaded in databases.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {bundles.map((b, idx) => {
                      const active = selectedBundle?.id === b.id;
                      const isPopular = idx === 1;
                      const sellPrice = priceFor(b);

                      return (
                        <button
                          key={b.id}
                          onClick={() => {
                            setSelectedBundle(b);
                            setCheckoutOpen(true);
                          }}
                          className={`relative flex flex-col text-left p-3.5 rounded-2xl border transition-all duration-300 ${
                            active
                              ? "bg-slate-950 text-white border-rose-500"
                              : "bg-slate-50/50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
                          }`}
                        >
                          {isPopular && (
                            <span className="absolute -top-2 left-2 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm">
                              Popular
                            </span>
                          )}
                          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">
                            {selectedNetwork.name}
                          </span>
                          <span className="text-xl font-black tracking-tight leading-none mb-2">
                            {b.size_label}
                          </span>
                          <span className={`text-xs font-black mt-auto ${active ? "text-rose-400" : "text-slate-800 dark:text-white"}`}>
                            {formatGHS(sellPrice)}
                          </span>
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
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 p-5 rounded-[28px] shadow-sm space-y-2">
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
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 p-5 rounded-[28px] shadow-sm space-y-4">
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
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 p-6 rounded-[28px] shadow-sm space-y-4">
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
        <DraggableWhatsApp link={agent.support_whatsapp} />
      )}

      {/* Agent Login Modal */}
      {loginOpen && (
        <AgentLogin storeName={agent?.store_name || "Agent Store"} onClose={() => setLoginOpen(false)} />
      )}

    </div>
  );
}
