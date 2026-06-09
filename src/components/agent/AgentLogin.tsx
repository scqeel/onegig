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
      const isPhone = /^[0-9+() -]{9,}$/.test(identifier.trim());
      let finalPayload: any = { password };

      if (isPhone) {
        let p = identifier.replace(/[^0-9+]/g, "");
        if (p.startsWith("0")) p = "+233" + p.substring(1);
        else if (p.startsWith("233")) p = "+" + p;
        else if (!p.startsWith("+")) p = "+233" + p;
        finalPayload.phone = p;
      } else {
        finalPayload.email = identifier.trim().toLowerCase();
      }

      const { error } = await supabase.auth.signInWithPassword(finalPayload);

      if (error) throw error;
      toast({ title: "Welcome back!", description: "Accessing Agent Dashboard..." });
      // The auth context will update and AgentStore will automatically show the dashboard
    } catch (e: any) {
      toast({ title: "Login Failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] overflow-hidden shadow-2xl relative animate-in slide-in-from-bottom-8 duration-500">
        
        {/* Decorative Header */}
        <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 px-8 py-10 relative overflow-hidden text-center">
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-rose-500/20 blur-3xl" />
          <div className="absolute -left-10 -bottom-10 w-40 h-40 rounded-full bg-indigo-500/20 blur-3xl" />
          
          <div className="mx-auto h-16 w-16 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 flex items-center justify-center text-white mb-4 shadow-xl">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-black text-white flex justify-center items-center gap-2">
            Agent Portal <Sparkles className="h-4 w-4 text-yellow-400 fill-yellow-400/20" />
          </h2>
          <p className="text-slate-400 text-sm font-medium mt-2">Sign in to manage {storeName}</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="p-8 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              Agent Email or Phone
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="agent@example.com or 054..."
                className="h-14 pl-12 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-base font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              Secure Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-14 pl-12 pr-10 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-base font-semibold w-full"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-3">
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base shadow-lg shadow-indigo-600/20 transition-all"
            >
              {loading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <ArrowRight className="h-5 w-5 mr-2" />}
              {loading ? "Authenticating..." : "Sign In to Dashboard"}
            </Button>
            
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="w-full h-12 rounded-xl text-slate-500 dark:text-slate-400 font-semibold"
            >
              Back to Storefront
            </Button>
          </div>
        </form>

      </div>
    </div>
  );
}
