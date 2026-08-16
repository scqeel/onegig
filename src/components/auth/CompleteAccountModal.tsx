import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Mail, Lock, Sparkles, Loader2 } from "lucide-react";

interface CompleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function CompleteAccountModal({ isOpen, onClose, onComplete }: CompleteAccountModalProps) {
  const { user, profile, refresh } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState(profile?.email || user?.email || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      toast({ title: "Valid email required", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }

    if (!password || password.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", description: "Please make sure your passwords match.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // 1. Update Supabase Auth user email and password
      const { error: authError } = await supabase.auth.updateUser({
        email: trimmedEmail,
        password: password,
      });

      if (authError) throw authError;

      // 2. Update profiles table
      if (user?.id) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ email: trimmedEmail })
          .eq("id", user.id);

        if (profileError) {
          console.error("Failed to update profile email", profileError);
        }
      }

      // 3. Refresh AuthContext state
      await refresh();

      toast({
        title: "Account Completed! 🎉",
        description: "Your email and password have been saved. Proceeding with purchase...",
      });

      onComplete();
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.message || "Failed to update account details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !loading && onClose()}>
      <DialogContent className="w-[92vw] max-w-md rounded-[1.75rem] bg-card border border-border p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <DialogHeader className="text-center flex flex-col items-center pb-2">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3 border border-primary/20">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-1.5 justify-center">
            Complete Your Account <Sparkles className="h-4 w-4 text-amber-500" />
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1 max-w-xs text-center leading-relaxed">
            Please add your email and set a password to secure your account before proceeding with your purchase.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Email Input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                required
                placeholder="your.name@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-11 rounded-xl text-sm font-semibold border-border bg-background"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Create Password</Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                required
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-11 rounded-xl text-sm font-semibold border-border bg-background"
              />
            </div>
          </div>

          {/* Confirm Password Input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                required
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 h-11 rounded-xl text-sm font-semibold border-border bg-background"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl text-xs uppercase tracking-wider font-bold shadow-md"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving Details...
                </>
              ) : (
                "Save & Continue to Payment"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
