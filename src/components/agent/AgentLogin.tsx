import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Lock, Mail, ArrowRight, Loader2, Sparkles, Eye, EyeOff } from "lucide-react";

interface Props {
  storeName: string;
  onClose: () => void;
}

export function AgentLogin({ storeName, onClose }: Props) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) return toast({ title: "Please fill in all fields", variant: "destructive" });
    
    setLoading(true);
    try {
      const trimmedId = identifier.trim();
      const isPhone = /^[0-9+() -]{9,}$/.test(trimmedId);
      let finalPayload: any = { password };
      let phoneNum = "";

      if (isPhone) {
        let p = trimmedId.replace(/[^0-9+]/g, "");
        if (p.startsWith("0")) p = "+233" + p.substring(1);
        else if (p.startsWith("233")) p = "+" + p;
        else if (!p.startsWith("+")) p = "+233" + p;
        phoneNum = p;
        finalPayload.phone = p;
      } else {
        finalPayload.email = trimmedId.toLowerCase();
      }

      let res = await supabase.auth.signInWithPassword(finalPayload);

      // Fallback: If phone login failed (e.g. user registered with email), look up email by phone
      if (res.error && isPhone && phoneNum) {
        const rawDigits = trimmedId.replace(/\D/g, "");
        const { data: userProf } = await supabase
          .from("profiles")
          .select("email")
          .or(`phone.eq.${phoneNum},phone.eq.${rawDigits}`)
          .maybeSingle();

        if (userProf?.email) {
          res = await supabase.auth.signInWithPassword({ email: userProf.email, password });
        }
      }

      if (res.error) {
        const errorText = res.error.message.includes("Invalid login credentials")
          ? "Invalid email/phone or password. Please verify your credentials or sign up."
          : res.error.message;
        throw new Error(errorText);
      }

      toast({ title: "Welcome back!", description: "Accessing Agent Dashboard..." });
    } catch (e: any) {
      toast({ title: "Login Failed", description: e.message || "Invalid login credentials", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-in fade-in duration-300 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-[32px] overflow-hidden shadow-2xl relative animate-in slide-in-from-bottom-8 duration-500">

        {/* Header */}
        <div className="dark bg-background px-8 py-10 relative text-center">
          <div className="mx-auto h-16 w-16 bg-primary/10 rounded-2xl border border-primary/20 flex items-center justify-center text-primary mb-4">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-foreground flex justify-center items-center gap-2">
            Agent Portal <Sparkles className="h-4 w-4 text-amber-400 fill-amber-400/20" />
          </h2>
          <p className="text-muted-foreground text-sm font-medium mt-2">Sign in to manage {storeName}</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="p-8 space-y-5">
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wider">
              Agent Email or Phone
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="agent@example.com or 054..."
                className="h-14 pl-12 rounded-xl bg-background border-border text-base font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wider">
              Secure Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-14 pl-12 pr-10 rounded-xl bg-background border-border text-base font-semibold w-full"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-3">
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-xl text-base"
            >
              {loading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <ArrowRight className="h-5 w-5 mr-2" />}
              {loading ? "Authenticating..." : "Sign In to Dashboard"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="w-full h-12 rounded-xl text-muted-foreground font-semibold"
            >
              Back to Storefront
            </Button>
          </div>
        </form>

      </div>
    </div>
  );
}
