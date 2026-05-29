import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function PaymentCallbackPage() {
  const nav = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const transaction_id = useMemo(
    () => searchParams.get("transaction_id") || searchParams.get("reference") || searchParams.get("trxref") || "",
    [searchParams]
  );

  useEffect(() => {
    const run = async () => {
      if (!transaction_id) {
        toast({ title: "Payment reference missing", variant: "destructive" });
        nav("/dashboard", { replace: true });
        return;
      }

      const { data, error } = await supabase.functions.invoke("paystack-verify", {
        body: { reference: transaction_id },
      });

      if (error || !data?.ok) {
        toast({
          title: "Payment verification failed",
          description: data?.error || error?.message,
          variant: "destructive",
        });
        nav("/dashboard", { replace: true });
        return;
      }

      if (data.purpose === "agent_activation") {
        toast({ title: "Payment successful", description: "Your agent account is now active." });
        nav("/agent", { replace: true });
        return;
      }

      toast({ title: "Payment successful", description: "Your order has been processed." });
      nav("/dashboard/track", { replace: true });
    };

    run();
  }, [nav, transaction_id, toast]);

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#080c1a] px-6 text-center">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />

      <div className="relative flex flex-col items-center">
        {/* Spinner in gradient box */}
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl gradient-primary shadow-glow">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>

        <h2 className="mt-6 text-xl font-bold text-white">Verifying payment</h2>
        <p className="mt-2 max-w-xs text-sm text-white/45">
          Please wait while we securely confirm your transaction…
        </p>

        {/* Animated dots */}
        <div className="mt-7 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse [animation-delay:0.25s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse [animation-delay:0.5s]" />
        </div>

        <p className="mt-8 text-xs text-white/20">Do not close this page</p>
      </div>
    </div>
  );
}
