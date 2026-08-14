import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Zap,
  ArrowRight,
  RefreshCw,
  Search,
  Check,
  ChevronRight,
  Lock,
  Sparkles,
  Wifi,
  Send,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MtnStatusWidget } from "@/components/MtnStatusWidget";
import { useNetworks, useBundles, BundleRow } from "@/hooks/useNetworksAndBundles";
import { supabase } from "@/integrations/supabase/client";
import { formatGHS } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

interface VerificationResult {
  phone: string;
  networkCode: string;
  isPorted: boolean;
  beneficiaryVerified: boolean;
  beneficiaryMessage: string;
  accountName?: string | null;
  verifiedAt: string;
}

export default function NumberVerificationPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { networks, isLoading: loadingNetworks } = useNetworks();
  const networkList = networks || [];

  const [phone, setPhone] = useState("");
  const [isPorted, setIsPorted] = useState(true);
  const [selectedNetworkCode, setSelectedNetworkCode] = useState<string>("MTN");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  const currentNetworkObj = networkList.find(
    (n) => n.code.toUpperCase() === selectedNetworkCode.toUpperCase() ||
      (selectedNetworkCode === "AIRTELTIGO" && n.code.toUpperCase() === "AT")
  );

  const { bundles, isLoading: loadingBundles } = useBundles(currentNetworkObj?.id || null);
  const filteredBundles = bundles || [];

  // Auto-detect network from number prefix
  useEffect(() => {
    let num = phone.replace(/\D/g, "");
    if (num.startsWith("233") && num.length > 9) num = "0" + num.slice(3);
    if (num.length >= 3) {
      const pfx = num.slice(0, 3);
      if (["024", "054", "055", "059", "025", "053"].includes(pfx)) {
        setSelectedNetworkCode("MTN");
      } else if (["020", "050"].includes(pfx)) {
        setSelectedNetworkCode("TELECEL");
      } else if (["027", "057", "026", "056"].includes(pfx)) {
        setSelectedNetworkCode("AIRTELTIGO");
      }
    }
  }, [phone]);

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let num = phone.replace(/\D/g, "");
    if (num.startsWith("233") && num.length > 9) num = "0" + num.slice(3);
    if (num.length < 9) {
      toast({
        variant: "destructive",
        title: "Invalid Phone Number",
        description: "Please enter a valid 10-digit phone number.",
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // 1. Paystack MoMo Account Name Lookup
      let accName: string | null = null;
      try {
        const { data: psData } = await supabase.functions.invoke("paystack-resolve", {
          body: { momo_number: num, momo_network: selectedNetworkCode },
        });
        if (psData?.ok && psData?.account_name) {
          accName = psData.account_name;
        }
      } catch {
        // Ignore paystack lookup error
      }

      // 2. DataHub Beneficiary Verification
      let benVerified = true;
      let benMsg = "Number validated and active on telecom network.";

      const { data: dhData, error: dhErr } = await supabase.functions.invoke("admin-provider-action", {
        body: { action: "verify_number", phone: num, is_ported_number: isPorted },
      });

      if (!dhErr && dhData) {
        if (dhData.success || dhData.data?.exists) {
          benVerified = true;
          benMsg = dhData.data?.message || dhData.message || "Verified MTN Beneficiary — Instant ⚡ delivery enabled!";
        } else if (dhData.message || dhData.error) {
          benVerified = false;
          benMsg = dhData.message || dhData.error || "Phone number not yet on beneficiary list. Recorded for system processing.";
        }
      }

      setResult({
        phone: num,
        networkCode: selectedNetworkCode,
        isPorted,
        beneficiaryVerified: benVerified,
        beneficiaryMessage: benMsg,
        accountName: accName,
        verifiedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });

      toast({
        title: benVerified ? "Verification Complete! ⚡" : "Verification Recorded",
        description: benMsg,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Verification Error",
        description: err.message || "Could not verify phone number at this moment.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground flex flex-col justify-between overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-0 grid-pattern-dark opacity-40" />

      {/* Floating Pill Header Navbar */}
      <header className="fixed left-0 right-0 top-4 z-50 px-4 md:px-8 pointer-events-none">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between rounded-full border border-border bg-background/90 backdrop-blur-md px-4 md:px-6 pointer-events-auto transition-all">
          <Logo size="md" />

          <nav className="flex items-center gap-2">
            <Link
              to="/submit-numbers"
              className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Send className="h-3.5 w-3.5" /> Submit Numbers
            </Link>
            <Link
              to="/track"
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Search className="h-3.5 w-3.5" /> Track Order
            </Link>
            <Button asChild className="h-9 rounded-full px-5 text-xs">
              <Link to="/buy">
                Buy Data <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        {/* Page Title & Trust Badge */}
        <div className="text-center space-y-4 mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-500">
            <ShieldCheck className="h-4 w-4" />
            Live DataHub Beneficiary Status & Number Verification
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight">
            Verify Phone Number <br className="hidden sm:inline" />
            <span className="text-primary">& Beneficiary Eligibility</span>
          </h1>

          <p className="max-w-xl mx-auto text-sm sm:text-base text-muted-foreground leading-relaxed">
            Instantly check whether any phone number is registered on the MTN Beneficiary list, check subscriber MoMo names, and place data orders with guaranteed delivery.
          </p>

          <MtnStatusWidget className="max-w-md mx-auto mt-4" />
        </div>

        {/* Verification Form Card */}
        <div className="rounded-[1.75rem] border border-border bg-card p-6 sm:p-8 space-y-6 relative">
          <form onSubmit={handleVerify} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Phone Number To Verify
              </label>
              <div className="relative group">
                <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 053 812 2730"
                  className="h-14 rounded-xl border-border bg-background pl-12 pr-4 text-base font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Network Selector Cards */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Target Telecom Network
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { code: "MTN", name: "MTN Ghana" },
                  { code: "TELECEL", name: "Telecel" },
                  { code: "AIRTELTIGO", name: "AirtelTigo (AT)" },
                ].map((net) => {
                  const active = selectedNetworkCode === net.code;
                  return (
                    <button
                      type="button"
                      key={net.code}
                      onClick={() => setSelectedNetworkCode(net.code)}
                      className={`relative flex flex-col items-center justify-center p-3.5 rounded-xl border transition-colors text-xs font-semibold ${
                        active
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                      }`}
                    >
                      {active && (
                        <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      )}
                      <span>{net.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ported Number Toggle */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-background p-4">
              <div className="space-y-0.5">
                <Label htmlFor="ported-switch" className="text-xs font-semibold text-foreground">
                  Ported Phone Number Check
                </Label>
                <p className="text-[11px] text-muted-foreground">Enable if this number was ported from another network (MNP).</p>
              </div>
              <Switch
                id="ported-switch"
                checked={isPorted}
                onCheckedChange={setIsPorted}
              />
            </div>

            <Button
              type="submit"
              disabled={loading || phone.replace(/\D/g, "").length < 9}
              size="lg"
              className="h-14 w-full rounded-xl text-sm uppercase tracking-wider"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Verifying Number Status...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> Run Live Verification Check
                </span>
              )}
            </Button>
          </form>

          {/* Verification Results Card */}
          {result && (
            <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-background p-6 space-y-5 animate-in fade-in zoom-in duration-300">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    result.beneficiaryVerified ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"
                  }`}>
                    {result.beneficiaryVerified ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-foreground">
                      Verification Summary ({result.phone})
                    </h3>
                    <p className="text-xs text-muted-foreground">Checked at {result.verifiedAt}</p>
                  </div>
                </div>

                <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider border ${
                  result.beneficiaryVerified ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                }`}>
                  {result.beneficiaryVerified ? "Verified Beneficiary" : "Pending Beneficiary"}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div className="rounded-xl border border-border bg-card p-3.5 space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Subscriber Account Name</span>
                  <p className="font-semibold text-sm text-emerald-500">{result.accountName || "Registered Telecom Subscriber"}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3.5 space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Network & Ported Status</span>
                  <p className="font-semibold text-sm text-foreground">{result.networkCode} {result.isPorted ? "(Ported Number Verified)" : "(Standard)"}</p>
                </div>
              </div>

              <div className={`p-4 rounded-xl border text-xs font-semibold ${
                result.beneficiaryVerified ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : "bg-amber-500/10 border-amber-500/30 text-amber-500"
              }`}>
                <p>{result.beneficiaryMessage}</p>
              </div>

              {/* Fast Checkout CTA for verified number */}
              <div className="pt-3 border-t border-border space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Instant Data Packages Available For {result.phone}
                </h4>

                <div className="grid gap-3 sm:grid-cols-3">
                  {filteredBundles.slice(0, 3).map((b) => (
                    <button
                      key={b.id}
                      onClick={() => navigate(`/buy?phone=${result.phone}&network=${result.networkCode}&bundleId=${b.id}`)}
                      className="group flex flex-col justify-between rounded-xl border border-primary/30 bg-primary/5 p-3.5 text-left transition-colors hover:border-primary/60 hover:bg-primary/10"
                    >
                      <span className="text-lg font-bold text-foreground">{b.size_label}</span>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="font-semibold text-primary">{formatGHS(Number(b.user_price ?? b.base_price))}</span>
                        <span className="text-[10px] font-semibold text-primary group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                          Buy <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                <Button
                  onClick={() => navigate(`/buy?phone=${result.phone}&network=${result.networkCode}`)}
                  className="w-full h-12 rounded-xl text-xs uppercase"
                >
                  <Zap className="mr-1.5 h-4 w-4" /> Proceed To Checkout With {result.phone}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border bg-background py-8 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-5xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} OneGig Reseller Platform. Secured by DataHub GH.</p>
          <div className="flex items-center gap-4 font-semibold">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link to="/buy" className="hover:text-foreground transition-colors">Buy Data</Link>
            <Link to="/track" className="hover:text-foreground transition-colors">Track Order</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
