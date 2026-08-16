import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNetworks, useBundles, BundleRow, NetworkRow } from "@/hooks/useNetworksAndBundles";
import { useSettings } from "@/hooks/useSettings";
import { VerifiedPhoneInput } from "@/components/VerifiedPhoneInput";
import { TrackOrder } from "@/components/buy/TrackOrder";
import { OrderSummary } from "@/components/buy/OrderSummary";
import { formatGHS, isSamePhoneNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
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
  const { data: settings } = useSettings();
  const activeGateway = settings?.active_payment_gateway || "paystack";

  // Navigation & Theme tabs
  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const [accent, setAccent] = useState<ThemeAccent>("rose");
  const [currentTime, setCurrentTime] = useState("");

  // Order state
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkRow | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<BundleRow | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "non-expiry" | "monthly">("all");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [momoNumber, setMomoNumber] = useState("");
  const [momoNetwork, setMomoNetwork] = useState<string>("MTN");
  const [email, setEmail] = useState(profile?.email || "");
  const [phase, setPhase] = useState<Phase>("select");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

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

  // Checkout flow
  const initiatePayment = async () => {
    if (!settings) {
      toast({ title: "Loading settings", description: "Payment configuration is still loading. Please try again in a moment.", variant: "destructive" });
      return;
    }
    if (!selectedBundle || !phone || phone.replace(/\D/g, "").length < 9) {
      toast({ title: "Enter recipient phone", variant: "destructive" });
      return;
    }

    if (activeGateway === "theteller") {
      return payWithRedirect();
    }

    if (!momoNumber || momoNumber.replace(/\D/g, "").length < 9) {
      toast({ title: "Enter mobile money number", variant: "destructive" });
      return;
    }

    setCheckoutOpen(false);
    setPhase("processing");
    try {

      const { data, error } = await supabase.functions.invoke(`${activeGateway}-process`, {
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

  if (loadingAgent || loadingPrices || !agent) {
    return <LoadingScreen message="Loading Storefront..." submessage="Fetching agent packages & live market prices" />;
  }

  if (phase === "success") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-6 text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        </div>
        <h3 className="mt-6 text-3xl font-bold text-foreground">Order Successful! 🎉</h3>
        <p className="mt-2 font-medium text-muted-foreground">
          Data has been delivered to <span className="font-semibold text-foreground">{phone}</span>
        </p>
        <div className="mt-8">
          <Button onClick={() => setPhase("select")} className="h-12 rounded-2xl px-8">
            Return to Store
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-6 text-center animate-in fade-in zoom-in duration-300">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-destructive/10 border border-destructive/20">
          <RefreshCcw className="h-12 w-12 text-destructive animate-spin [animation-duration:10s]" />
        </div>
        <h3 className="mt-6 text-xl font-bold text-foreground">Payment Failed</h3>
        <p className="mt-2 font-medium text-destructive px-4 max-w-md mx-auto">{errorMsg}</p>
        <div className="mt-8 flex flex-col gap-3 max-w-[280px] w-full mx-auto">
          <Button
            onClick={payWithRedirect}
            className="h-13 rounded-2xl w-full flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" ry="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
            Pay via Secure Web Page
          </Button>
          <Button
            variant="outline"
            onClick={() => { setPhase("select"); setOtp(""); setAuthMessage(null); }}
            className="h-13 rounded-2xl w-full font-semibold"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "otp") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-6 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
          <Lock className="h-10 w-10 text-primary" />
        </div>
        <h3 className="mt-6 text-2xl font-bold text-foreground">Verification Required</h3>
        <p className="mt-2 text-sm font-medium text-muted-foreground max-w-[280px]">
          Please enter the OTP or Voucher Code sent to your mobile number ({momoNumber}).
        </p>

        {errorMsg && (
          <p className="mt-3 text-xs font-semibold text-destructive">{errorMsg}</p>
        )}

        <div className="mt-8 w-full max-w-[280px] space-y-5">
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
                    className="h-14 w-12 rounded-xl border border-border bg-background text-xl font-bold shadow-soft transition-all focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <div className="flex items-center justify-between px-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => { setPhase("select"); setOtp(""); setAuthMessage(null); }}
              className="h-auto p-0 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancel Order
            </Button>
            <Button
              variant="ghost"
              onClick={initiatePayment}
              className="h-auto p-0 text-xs text-primary font-semibold hover:underline"
            >
              Try again
            </Button>
          </div>

          <div className="mt-6">
            <Button
              id="btn-public-otp-submit"
              onClick={() => submitOtp()}
              disabled={otp.length < 4}
              className="w-full h-12 rounded-xl"
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
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-6 text-center">
        <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-primary/10 border border-primary/20 animate-pulse">
          {phase === "delivering" ? <CheckCircle2 className="h-14 w-14 text-emerald-500" /> : <Loader2 className="h-14 w-14 text-primary animate-spin" />}
        </div>
        <h3 className="mt-8 text-2xl font-bold text-foreground">
          {phase === "processing" && "Initiating Payment..."}
          {phase === "polling" && "Awaiting Authorization"}
          {phase === "delivering" && "Payment Received! Sending Data..."}
        </h3>

        {phase === "polling" && (
          <div className="mt-4 flex flex-col items-center">
            <div className="flex items-center gap-2.5 text-sm font-semibold text-primary bg-primary/5 px-5 py-2.5 rounded-full border border-primary/20">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
              </span>
              {authMessage || `Please check your phone (${momoNumber}) to authorize...`}
            </div>
          </div>
        )}

        {phase === "delivering" && (
          <p className="mt-4 text-sm font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-5 py-2.5 rounded-full border border-emerald-200 dark:border-emerald-800/50 inline-block">
            Connecting to {selectedNetwork?.name} network to deliver your bundle.
          </p>
        )}

        <p className="mt-6 text-xs font-medium text-muted-foreground">
          Do not close this window. Your bundle will be delivered automatically.
        </p>

        {(phase === "polling" || phase === "delivering") && (
          <div className="mt-6 flex items-center justify-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce" />
            <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce [animation-delay:0.2s]" />
            <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce [animation-delay:0.4s]" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-24 text-foreground transition-colors duration-300">
      <div className="mx-auto max-w-md px-4 pt-4 space-y-4">

        {/* ── CARD HEADER (always-dark hero surface) ── */}
        <div className="dark bg-background border border-border text-foreground rounded-[1.75rem] p-6 relative overflow-hidden transition-all duration-500">

          {/* Profile details */}
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                {agent.store_name}
                <Sparkles className="h-5 w-5 text-primary" />
              </h1>
              <p className="text-sm text-muted-foreground font-medium">
                {agent.store_tagline || "Welcome to Mtopup"}
              </p>
              <div className="pt-2">
                <span className="inline-block text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full uppercase tracking-wider">
                  GHANA · RESELLER PLATFORM
                </span>
              </div>
            </div>

            {/* Custom Theme Switcher */}
            <button
              onClick={rotateAccent}
              title="Change Accent Color"
              className="bg-secondary text-muted-foreground p-2.5 rounded-full hover:bg-accent transition-all border border-border relative group"
            >
              <Paintbrush className="h-4.5 w-4.5 group-hover:rotate-12 transition-transform" />
              <span className="absolute -bottom-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
              </span>
            </button>
          </div>

          {/* Header Action Grid (Tabs) */}
          <div className="grid grid-cols-4 gap-2 mt-6">
            {[
              { id: "orders", label: "Orders", icon: ShoppingBag },
              { id: "trans", label: "Trans", icon: Receipt },
              { id: "bulk", label: "Bulk", icon: Layers },
              { id: "store", label: "Store", icon: Store },
            ].map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as Tab)}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-300 border",
                    active
                      ? "border-primary/40 bg-primary/15 text-foreground"
                      : "border-border bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "h-9 w-9 rounded-xl flex items-center justify-center mb-1.5 transition-all",
                      active ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"
                    )}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-[10px] font-bold tracking-wide uppercase">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── CONDITIONAL RENDERING OF TABS ── */}

        {activeTab === "orders" && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">

            {/* System Status online bar */}
            <div className="flex items-center justify-between bg-card border border-border px-5 py-3.5 rounded-2xl shadow-soft">
              <div className="flex items-center">
                <span className="relative flex h-3 w-3 mr-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-foreground">System Online</span>
                    <span className="bg-emerald-500 text-white font-bold text-[8px] px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                      24/7
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-semibold">{currentTime || "12:26:36 AM"}</p>
                </div>
              </div>

              <div className="flex gap-1.5">
                {[Zap, Shield, Wifi].map((Icon, idx) => (
                  <div
                    key={idx}
                    className="h-8 w-8 rounded-xl bg-secondary border border-border flex items-center justify-center text-primary shadow-soft"
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                ))}
              </div>
            </div>

            {/* Need Help Card */}
            <div
              onClick={() => handleQuickAction("reward")}
              className="flex items-center justify-between bg-card border border-border p-4 rounded-2xl shadow-soft cursor-pointer hover:bg-accent transition-all duration-300"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-100 dark:border-cyan-900/50 flex items-center justify-center text-cyan-500 shadow-soft">
                  <Headphones className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Need Help?</h3>
                  <p className="text-[10px] text-muted-foreground font-medium">Chat with our support team</p>
                </div>
              </div>
              <div className="flex text-muted-foreground/60">
                <ChevronRight className="h-4 w-4" />
                <ChevronRight className="h-4 w-4 -ml-2" />
              </div>
            </div>

            {/* MTN / ATigo / Telecel selector */}
            <div id="place-new-order" className="space-y-3 pt-2">
              <h2 className="text-lg font-bold text-foreground tracking-tight">
                Place New Order
              </h2>

              <div className="grid grid-cols-4 gap-2.5">
                {[
                  {
                    id: "mtn",
                    name: "MTN",
                    logo: (
                      <div className="h-12 w-12 rounded-full bg-[#ffcc00] flex items-center justify-center border border-yellow-200 shadow-soft relative overflow-hidden scale-95">
                        <div className="border border-blue-900/60 rounded-full w-9 h-6 flex items-center justify-center bg-transparent">
                          <span className="text-[9px] font-bold text-blue-950 tracking-tighter">MTN</span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: "atigo",
                    name: "ATigo",
                    logo: (
                      <div className="h-12 w-12 rounded-xl bg-[#0f2f5f] flex flex-col justify-between items-center border border-blue-900 shadow-soft overflow-hidden p-1 relative scale-95">
                        <div className="flex-1 flex items-center justify-center">
                          <span className="text-xs font-bold text-white italic tracking-tighter">at</span>
                        </div>
                        <div className="w-full h-2 bg-[#e31a22] rounded-b-lg absolute bottom-0 left-0" />
                      </div>
                    ),
                  },
                  {
                    id: "telecel",
                    name: "Telecel",
                    logo: (
                      <div className="h-12 w-12 rounded-full bg-[#e30613] flex items-center justify-center border border-red-500 shadow-soft overflow-hidden scale-95">
                        <div className="h-6 w-6 rounded-full bg-white flex items-center justify-center">
                          <span className="text-[10px] font-bold text-[#e30613] tracking-tighter">t</span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: "check",
                    name: "Check...",
                    logo: (
                      <div className="h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center border border-emerald-200 dark:border-emerald-900/50 shadow-soft scale-95">
                        <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                      </div>
                    ),
                  },
                ].map((net) => {
                  const isCheck = net.id === "check";
                  const active = isCheck
                    ? selectedNetwork === null && (activeTab as string) === "trans"
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
                      className="flex flex-col items-center p-3 rounded-2xl bg-card border transition-all duration-300 shadow-soft"
                      style={{
                        borderColor: active ? currentAccent.primary : undefined,
                        boxShadow: active ? `0 0 12px ${currentAccent.primary}15` : undefined
                      }}
                    >
                      {net.logo}
                      <span className="text-[10px] font-bold text-muted-foreground mt-2">{net.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* BUNDLE LIST FOR SELECTED NETWORK */}
            {selectedNetwork && (
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft space-y-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <h3 className="font-bold text-sm text-foreground">
                      Select {selectedNetwork.name} Bundle
                    </h3>
                    <p className="text-[10px] text-muted-foreground font-medium">Select a bundle to place order</p>
                  </div>
                  <button
                    onClick={() => setSelectedNetwork(null)}
                    className="text-[10px] font-bold text-primary hover:underline uppercase"
                  >
                    Clear
                  </button>
                </div>

                {loadingBundles ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : bundles.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-4">No active bundles loaded in databases.</p>
                ) : (
                  <>
                    {/* Category Filter Sub-tabs */}
                    <div className="mb-4 flex gap-1 p-1 bg-secondary rounded-2xl max-w-sm">
                      {[
                        { id: "all", label: "All" },
                        { id: "non-expiry", label: "Non-Expiry" },
                        { id: "monthly", label: "Regular/Monthly" }
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategoryFilter(cat.id as any)}
                          className={cn(
                            "flex-1 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-xl transition-all duration-200",
                            categoryFilter === cat.id
                              ? "bg-background text-foreground shadow-soft border border-border"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    {bundles.filter(b => {
                      const isNonExpiry = b.size_label.toLowerCase().includes("non-expiry") || b.size_label.toLowerCase().includes("no-expiry");
                      if (categoryFilter === "non-expiry") return isNonExpiry;
                      if (categoryFilter === "monthly") return !isNonExpiry;
                      return true;
                    }).length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-4">No active bundles match the selected category.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2.5">
                        {bundles
                          .filter(b => {
                            const isNonExpiry = b.size_label.toLowerCase().includes("non-expiry") || b.size_label.toLowerCase().includes("no-expiry");
                            if (categoryFilter === "non-expiry") return isNonExpiry;
                            if (categoryFilter === "monthly") return !isNonExpiry;
                            return true;
                          })
                          .map((b, idx) => {
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
                                className={cn(
                                  "relative flex flex-col text-left p-3.5 rounded-2xl border transition-all duration-300",
                                  active
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-secondary/40 border-border hover:border-primary/30"
                                )}
                              >
                                {isPopular && (
                                  <span className="absolute -top-2 left-2 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase bg-primary text-primary-foreground shadow-soft">
                                    Popular
                                  </span>
                                )}
                                <span className={cn("text-[9px] font-bold uppercase tracking-wider mb-0.5", active ? "text-primary-foreground/70" : "text-muted-foreground")}>
                                  {selectedNetwork.name}
                                </span>
                                <span className="text-xl font-bold tracking-tight leading-none mb-2">
                                  {b.size_label}
                                </span>
                                <span className={cn("text-xs font-bold mt-auto", active ? "text-primary-foreground" : "text-foreground")}>
                                  {formatGHS(sellPrice)}
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Mtopup Balance Status Card */}
            <div className="bg-secondary/40 border border-border p-5 rounded-2xl shadow-soft">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-500 border border-amber-100 dark:border-amber-900/50">
                  <Wallet className="h-4.5 w-4.5" />
                </div>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Mtopup Balance</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">WALLET BALANCE</p>
                  <div className="flex items-baseline gap-1.5 pt-1">
                    <span className="text-2xl font-bold tracking-tight text-foreground">
                      GHS 0.00
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground">GHANA CEDI</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="space-y-3 pt-2">
              <h2 className="text-lg font-bold text-foreground tracking-tight">
                Quick Actions
              </h2>

              <div className="grid grid-cols-4 gap-3">
                {[
                  { id: "order", label: "Order", icon: ShoppingBag, color: "primary" },
                  { id: "reward", label: "Reward", icon: Gift, color: "emerald" },
                  { id: "data", label: "Data", icon: Database, color: "primary" },
                  { id: "deposit", label: "Deposit", icon: Wallet, color: "blue" },
                  { id: "trans", label: "Trans", icon: Receipt, color: "primary" },
                  { id: "vendor", label: "Vendor", icon: Store, color: "primary" },
                  { id: "store", label: "Store", icon: Store, color: "emerald" },
                  { id: "rollover", label: "Rollover", icon: Trophy, color: "amber" },
                ].map((act) => {
                  const Icon = act.icon;
                  const colClasses: Record<string, string> = {
                    primary: "bg-primary/10 text-primary border-primary/20",
                    emerald: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 border-emerald-100 dark:border-emerald-900/50",
                    blue: "bg-blue-50 dark:bg-blue-950/40 text-blue-500 border-blue-100 dark:border-blue-900/50",
                    amber: "bg-amber-50 dark:bg-amber-950/40 text-amber-500 border-amber-100 dark:border-amber-900/50",
                  };

                  return (
                    <button
                      key={act.id}
                      onClick={() => handleQuickAction(act.id)}
                      className="flex flex-col items-center justify-center p-3 rounded-2xl bg-card border border-border shadow-soft transition-all duration-300 hover:translate-y-[-2px] hover:shadow-float"
                    >
                      <div className={`h-10 w-10 rounded-2xl flex items-center justify-center border ${colClasses[act.color]}`}>
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground mt-2 truncate w-full text-center">
                        {act.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Branded Contacts Us card */}
            <div className="bg-card border border-border p-6 rounded-[1.75rem] shadow-soft space-y-5">
              <div className="flex items-center gap-3">
                <div className="dark h-10 w-10 rounded-full bg-background flex items-center justify-center border border-border text-primary shadow-inner">
                  <span className="font-bold text-sm tracking-tighter">II</span>
                </div>
                <div className="flex items-baseline">
                  <span className="text-xl font-bold text-foreground">Mto</span>
                  <span className="text-xl font-bold text-primary">pup</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                Your trusted source for affordable data bundles in Ghana & Nigeria. Fast delivery, stable connections.
              </p>

              <div className="space-y-3.5 pt-2 border-t border-border">
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">CONTACT US</p>

                {[
                  { icon: Phone, text: agent.support_phone || "0308047934", href: `tel:${agent.support_phone || "0308047934"}` },
                  { icon: Mail, text: "support@mtopup.shop", href: "mailto:support@mtopup.shop" },
                  { icon: MapPin, text: "Accra, Ghana", href: null },
                  { icon: Clock, text: "Mon - Sun: 8AM - 9PM", href: null },
                ].map((item, idx) => {
                  const Icon = item.icon;
                  const Comp = item.href ? "a" : "div";
                  return (
                    <Comp
                      key={idx}
                      href={item.href || undefined}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-2xl bg-secondary/50 border border-border text-xs font-semibold text-foreground transition-colors",
                        item.href ? "hover:bg-secondary" : ""
                      )}
                    >
                      <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="truncate">{item.text}</span>
                    </Comp>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {activeTab === "trans" && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-card border border-border p-5 rounded-2xl shadow-soft space-y-2">
              <h2 className="text-lg font-bold text-foreground">
                Track Order Status
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                Enter your phone number below to view recent data purchase records and delivery status.
              </p>
              <div className="pt-2">
                <TrackOrder />
              </div>
            </div>
          </div>
        )}

        {activeTab === "bulk" && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-card border border-border p-5 rounded-2xl shadow-soft space-y-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  Bulk Data Orders
                </h2>
                <p className="text-xs text-muted-foreground font-medium">
                  Submit multiple data orders simultaneously. Ideal for companies or teams.
                </p>
              </div>

              <div className="space-y-3.5 border-t border-border pt-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Bulk Recipients (Phone, Size)</label>
                  <textarea
                    rows={4}
                    placeholder="e.g.&#10;0241234567, 5GB&#10;0501234567, 10GB"
                    className="w-full mt-1.5 p-3 rounded-2xl border border-border bg-secondary/40 text-xs focus:ring-2 focus:ring-primary/40 outline-none"
                  />
                  <p className="text-[10px] text-muted-foreground font-medium mt-1">One record per line. Separate phone and size with a comma.</p>
                </div>

                <Button
                  onClick={() => {
                    toast({
                      title: "Bulk Submission Received!",
                      description: "Our reseller system is reviewing your bulk request. Please complete payment.",
                    });
                  }}
                  className="w-full h-12 rounded-2xl"
                >
                  <Layers className="mr-2 h-4 w-4" /> Submit Bulk Order
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "store" && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-card border border-border p-6 rounded-2xl shadow-soft space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                  <Store className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    {agent.store_name}
                  </h2>
                  <p className="text-xs text-primary font-bold uppercase tracking-wider">
                    RESELLER PARTNER STORE
                  </p>
                </div>
              </div>

              <div className="space-y-3.5 border-t border-border pt-4 text-xs font-semibold text-muted-foreground">
                <div className="flex justify-between items-center py-2 border-b border-border/60">
                  <span>Store Slug</span>
                  <span className="font-mono text-foreground">/store/{slug}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/60">
                  <span>Activation Status</span>
                  <span className="text-emerald-500 font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Fully Activated
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/60">
                  <span>Supported Regions</span>
                  <span className="text-foreground">Ghana & Nigeria</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span>Support Channel</span>
                  <span className="text-foreground">WhatsApp & Phone Call</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── FLOATING SUPPORT WIDGETS (Bottom Right) ── */}

      {/* WhatsApp bubble */}
      {agent.support_whatsapp && (
        <a
          href={agent.support_whatsapp}
          target="_blank"
          rel="noreferrer"
          className="fixed bottom-24 right-5 z-40 bg-emerald-500 hover:bg-emerald-600 text-white p-3.5 rounded-full shadow-float transition-all duration-300 group flex items-center justify-center animate-bounce"
          style={{ animationDuration: '3s' }}
        >
          <MessageCircle className="h-5.5 w-5.5 group-hover:scale-110 transition-transform" />
          <span className="absolute -top-1.5 -right-1.5 bg-destructive text-white font-bold text-[9px] h-5 w-5 rounded-full border-2 border-background flex items-center justify-center animate-pulse">
            !
          </span>
        </a>
      )}

      {/* Headset bubble */}
      {(agent.support_phone || agent.support_whatsapp) && (
        <a
          href={agent.support_whatsapp || `tel:${agent.support_phone}`}
          className="fixed bottom-6 right-5 z-40 bg-primary hover:bg-primary/90 text-primary-foreground p-3.5 rounded-full shadow-float transition-all duration-300 group flex items-center justify-center"
        >
          <Headphones className="h-5.5 w-5.5 group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-1.5 -right-1.5 bg-destructive text-white font-bold text-[9px] h-5 w-5 rounded-full border-2 border-background flex items-center justify-center">
            ?
          </span>
        </a>
      )}

      {/* ── CHECKOUT CONFIRM DIALOG ── */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="w-[94vw] max-w-sm max-h-[90dvh] overflow-y-auto rounded-[1.75rem] border border-border p-0 bg-card">

          {/* Top header strip */}
          <div className="dark bg-background text-foreground px-6 py-5 border-b border-border relative overflow-hidden">
            <DialogHeader>
              <DialogTitle className="text-left text-lg font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" /> Confirm Order
              </DialogTitle>
              <DialogDescription className="text-left text-xs text-muted-foreground">
                Please review purchase details before paying.
              </DialogDescription>
            </DialogHeader>

            {selectedBundle && selectedNetwork && (
              <div className="mt-4">
                <OrderSummary
                  heading={{ eyebrow: `${selectedNetwork.name} Bundle`, title: selectedBundle.size_label }}
                  rows={[
                    { label: "Total", value: formatGHS(finalPrice), emphasis: true },
                  ]}
                  className="bg-secondary/40 border-border"
                />
              </div>
            )}
          </div>

          {/* Checkout inputs */}
          <div className="space-y-4 px-6 py-5">
            <VerifiedPhoneInput
              value={phone}
              onChange={setPhone}
              networkCode={selectedNetwork?.code}
              label="Recipient Phone (Who is receiving data?)"
            />

            <div>
              <label className="mb-1.5 block text-xs font-bold text-muted-foreground">
                Payment Mobile Money Number (Who is paying?)
              </label>
              <div className="flex gap-2">
                <select
                  className="w-[100px] h-12 rounded-xl border border-border text-sm font-semibold focus-visible:ring-2 focus-visible:ring-primary/40 bg-background px-3 outline-none"
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
                  className="flex-1 h-12 rounded-xl border-border text-base font-semibold focus-visible:ring-primary"
                />
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground font-medium">
                The prompt will be sent to this number.
              </p>
              {isVerifying && (
                <div className="mt-2 text-xs text-primary flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
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
                (momoNumber.replace(/\D/g, "").length < 9) ||
                isVerifying
              }
              className="h-12 w-full rounded-xl text-xs font-bold uppercase transition-all duration-300"
            >
              <Zap className="mr-1.5 h-3.5 w-3.5 fill-current" /> Pay {selectedBundle ? formatGHS(finalPrice) : ""}
            </Button>

            <div className="flex items-center justify-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
              <Lock className="h-3.5 w-3.5" />
              Secured Payments · PCI-DSS Certified
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── GENERAL INFO POPUP (Quick Actions Dialog) ── */}
      {infoPopup && (
        <Dialog open={infoPopup.open} onOpenChange={(open) => setInfoPopup(open ? infoPopup : null)}>
          <DialogContent className="w-[94vw] max-w-sm rounded-[1.75rem] border border-border p-5 bg-card space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                <Sparkles className="h-5 w-5" />
              </div>
              <DialogHeader>
                <DialogTitle className="text-left text-base font-bold text-foreground">
                  {infoPopup.title}
                </DialogTitle>
                <DialogDescription className="sr-only">Information details</DialogDescription>
              </DialogHeader>
            </div>

            <p className="text-xs font-semibold text-muted-foreground leading-relaxed border-t border-border pt-3">
              {infoPopup.content}
            </p>

            <Button
              onClick={() => setInfoPopup(null)}
              className="w-full h-11 rounded-xl text-xs"
            >
              Understand
            </Button>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
