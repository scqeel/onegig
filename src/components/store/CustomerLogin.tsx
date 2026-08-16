import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { Phone, Lock, ArrowRight, Loader2, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  storeName: string;
}

export function CustomerLogin({ isOpen, onClose, storeName }: Props) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [phase, setPhase] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 9) {
      return toast({ title: "Invalid phone", description: "Please enter a valid phone number", variant: "destructive" });
    }
    
    setLoading(true);
    try {
      // In Supabase, phone auth usually expects E.164 format. We assume Ghana (+233) if no country code.
      let formattedPhone = phone.trim();
      if (formattedPhone.startsWith("0")) {
        formattedPhone = "+233" + formattedPhone.substring(1);
      } else if (!formattedPhone.startsWith("+")) {
        formattedPhone = "+233" + formattedPhone;
      }

      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (error) throw error;
      
      setPhase("otp");
      toast({ title: "OTP Sent!", description: "Check your phone for the verification code." });
    } catch (e: any) {
      toast({ title: "Failed to send OTP", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent, overrideOtp?: string) => {
    if (e) e.preventDefault();
    const finalOtp = overrideOtp || otp;
    if (!finalOtp || finalOtp.length < 6) return;
    
    setLoading(true);
    try {
      let formattedPhone = phone.trim();
      if (formattedPhone.startsWith("0")) formattedPhone = "+233" + formattedPhone.substring(1);
      else if (!formattedPhone.startsWith("+")) formattedPhone = "+233" + formattedPhone;

      const { error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: finalOtp,
        type: 'sms'
      });

      if (error) throw error;
      
      toast({ title: "Verified successfully!", description: "You are now logged in." });
      onClose();
    } catch (e: any) {
      toast({ title: "Verification Failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto bg-card border border-border rounded-[1.75rem] p-6">
        <DialogHeader className="mb-6 pt-4 text-center items-center">
          <div className="h-16 w-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 mb-4">
            {phase === "phone" ? <Wallet className="h-8 w-8" /> : <Lock className="h-8 w-8" />}
          </div>
          <DialogTitle className="text-2xl font-bold text-foreground text-center">
            {phase === "phone" ? "Access Your Wallet" : "Verify Phone"}
          </DialogTitle>
          <DialogDescription className="text-center mt-1.5 text-muted-foreground font-medium">
            {phase === "phone"
              ? `Login with your phone number to check your wallet balance at ${storeName}.`
              : `We sent a 6-digit code to ${phone}.`
            }
          </DialogDescription>
        </DialogHeader>

        {phase === "phone" ? (
          <form onSubmit={handleSendOtp} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="024 XXX XXXX"
                  className="h-14 pl-12 rounded-xl bg-background border-border text-lg font-semibold tracking-wider"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || phone.length < 9}
              className="w-full h-14 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-lg transition-all"
            >
              {loading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : "Send Verification Code"}
            </Button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={(val) => {
                  setOtp(val);
                  if (val.length === 6) {
                    handleVerifyOtp(undefined, val);
                  }
                }}
              >
                <InputOTPGroup className="gap-2">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className="h-14 w-12 rounded-xl border border-border bg-background text-2xl font-bold shadow-soft focus-visible:border-emerald-500 focus-visible:ring-4 focus-visible:ring-emerald-500/20"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={handleVerifyOtp}
                disabled={otp.length < 6 || loading}
                className="w-full h-14 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-lg"
              >
                {loading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : "Verify & Login"}
              </Button>

              <Button
                variant="ghost"
                onClick={() => { setPhase("phone"); setOtp(""); }}
                className="w-full h-12 rounded-xl text-muted-foreground font-semibold"
              >
                Change Phone Number
              </Button>
            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
