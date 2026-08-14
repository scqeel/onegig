import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Copy, Gift, Share2, Users, Wallet, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Referrals() {
  const { session } = useAuth();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<any>(null);
  const [referralsCount, setReferralsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    
    const fetchData = async () => {
      setLoading(true);
      // Fetch user profile to get their referral code
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
        
      setProfile(prof);

      // Count referrals
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("referred_by", session.user.id);
        
      setReferralsCount(count || 0);
      setLoading(false);
    };

    fetchData();
  }, [session?.user?.id]);

  const referralLink = profile?.referral_code 
    ? `${window.location.origin}/auth?invite=${profile.referral_code}`
    : "";

  const copyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    toast({ title: "Link copied!", description: "Share it with your friends to start earning." });
  };

  const shareWhatsApp = () => {
    if (!referralLink) return;
    const text = `Join OneGig to buy cheap data that doesn't expire! Use my link: ${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Refer & Earn
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Invite friends to OneGig and earn GHS 1.00 when they make their first purchase!
          </p>
        </div>
        <div className="hidden rounded-full bg-primary/10 p-4 text-primary sm:block">
          <Gift className="h-8 w-8" />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Referral Link Card */}
        <div className="col-span-2 rounded-2xl border border-border bg-card p-6 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Share2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Your Referral Link</h2>
              <p className="text-sm text-muted-foreground">Share this link to invite friends</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1 overflow-hidden rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground">
              {loading ? "Loading..." : referralLink || "No code available"}
            </div>
            <div className="flex gap-2">
              <Button onClick={copyLink} disabled={!referralLink || loading} className="flex-1 shrink-0 gap-2 sm:flex-none">
                <Copy className="h-4 w-4" /> Copy
              </Button>
              <Button onClick={shareWhatsApp} disabled={!referralLink || loading} variant="outline" className="flex-1 shrink-0 gap-2 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 sm:flex-none">
                <Share2 className="h-4 w-4" /> WhatsApp
              </Button>
            </div>
          </div>

          {/* Referral Code display */}
          <div className="mt-8 flex items-center justify-between rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">Your Code</p>
              <p className="text-xl font-bold text-foreground">{profile?.referral_code || "..."}</p>
            </div>
            <Trophy className="h-8 w-8 text-primary/40" />
          </div>
        </div>

        {/* Stats Column */}
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-500">
                <Users className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Total Invited</p>
            </div>
            <div className="mt-4 text-3xl font-bold text-foreground">
              {loading ? "-" : referralsCount}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-500">
                <Wallet className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Est. Earnings</p>
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-sm font-semibold text-muted-foreground">GHS</span>
              <span className="text-3xl font-bold text-foreground">
                {loading ? "-" : (referralsCount * 1.0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="mt-10 rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h3 className="mb-6 text-xl font-bold text-foreground">How it works</h3>
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary font-semibold text-foreground">1</div>
            <p className="font-semibold text-foreground">Share your link</p>
            <p className="text-sm text-muted-foreground">Send your unique invite link or code to your friends.</p>
          </div>
          <div className="space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary font-semibold text-foreground">2</div>
            <p className="font-semibold text-foreground">They sign up</p>
            <p className="text-sm text-muted-foreground">Your friend creates a OneGig account using your code.</p>
          </div>
          <div className="space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">3</div>
            <p className="font-semibold text-foreground">You get rewarded</p>
            <p className="text-sm text-muted-foreground">When they make their first purchase or deposit, GHS 1.00 is added to your wallet instantly!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
