import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function PaymentCallbackPage() {
  const nav = useNavigate();
  const { toast } = useToast();
  const { refresh } = useAuth();
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

      let gateway = "paystack";
      try {
        const { data: payment } = await supabase
          .from("payments")
          .select("payload")
          .eq("reference", transaction_id)
          .maybeSingle();

        if (payment?.payload && typeof payment.payload === "object") {
          const payloadObj = payment.payload as any;
          if (payloadObj.gateway === "theteller") {
            gateway = "theteller";
          }
        } else {
          // Fallback to reference format or active_payment_gateway setting
          if (/^\d{12}$/.test(transaction_id)) {
            gateway = "theteller";
          } else {
            const { data: settingsData } = await supabase
              .from("app_settings")
              .select("value")
              .eq("key", "active_payment_gateway")
              .maybeSingle();
            if (settingsData?.value) {
              let val = settingsData.value;
              if (typeof val === "string") {
                try {
                  val = JSON.parse(val);
                } catch (_) {
                  // val remains the raw string
                }
              }
              if (val === "theteller") gateway = "theteller";
            }
          }
        }
      } catch (err) {
        console.error("Error detecting gateway", err);
      }

      const { data, error } = await supabase.functions.invoke(`${gateway}-verify`, {
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
        // Refresh roles so RequireAuth sees 'agent' immediately
        await refresh();
        toast({ title: "Payment successful", description: "Your agent account is now active." });
        nav("/agent", { replace: true });
        return;
      }

      toast({ title: "Payment successful", description: "Your order has been processed." });
      nav("/dashboard/track", { replace: true });
    };

    run();
  }, [nav, transaction_id, toast, refresh]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4 text-center">
      <div className="flex w-full max-w-sm flex-col items-center rounded-2xl border border-border bg-card px-8 py-10 shadow-soft">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>

        <h2 className="mt-5 text-xl font-bold text-foreground">Verifying payment</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Please wait while we securely confirm your transaction…
        </p>
        <p className="mt-6 border-t border-border pt-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Do not close this page
        </p>
      </div>
    </div>
  );
}
