import { ReactNode } from "react";
import { CheckCircle2, CreditCard, Loader2, Lock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";

export type StorePaymentPhase = "processing" | "otp" | "polling" | "delivering" | "success" | "error";

function StatusShell({
  tone,
  icon,
  title,
  children,
}: {
  tone: "primary" | "emerald" | "rose";
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  const tones = {
    primary: "border-primary/20 bg-primary/10 text-primary",
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
    rose: "border-rose-500/20 bg-rose-500/10 text-rose-500",
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-soft sm:p-8">
        <div className={cn("mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border", tones[tone])}>{icon}</div>
        <h3 className="mt-5 text-2xl font-bold text-foreground">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function StorePaymentStatus({
  phase,
  phone,
  momoNumber,
  networkName,
  authMessage,
  errorMsg,
  otp,
  otpTimer,
  onOtpChange,
  onSubmitOtp,
  onResendOtp,
  onCancel,
  onPayWithRedirect,
  onReturnToStore,
}: {
  phase: StorePaymentPhase;
  phone: string;
  momoNumber: string;
  networkName?: string | null;
  authMessage: string | null;
  errorMsg: string | null;
  otp: string;
  otpTimer: number;
  onOtpChange: (value: string) => void;
  onSubmitOtp: () => void;
  onResendOtp: () => void;
  onCancel: () => void;
  onPayWithRedirect: () => void;
  onReturnToStore: () => void;
}) {
  if (phase === "success") {
    return (
      <StatusShell tone="emerald" icon={<CheckCircle2 className="h-8 w-8" />} title="Order Successful! 🎉">
        <p className="mt-2 text-sm text-muted-foreground">
          Data has been delivered to <span className="font-semibold text-foreground">{phone}</span>
        </p>
        <Button onClick={onReturnToStore} className="mt-6 h-12 w-full rounded-xl font-bold">
          Return to Store
        </Button>
      </StatusShell>
    );
  }

  if (phase === "error") {
    return (
      <StatusShell tone="rose" icon={<XCircle className="h-8 w-8" />} title="Payment Failed">
        <p className="mt-2 text-sm font-medium text-rose-500">{errorMsg}</p>
        <div className="mt-6 flex flex-col gap-3">
          <Button onClick={onPayWithRedirect} className="h-12 w-full gap-2 rounded-xl font-bold">
            <CreditCard className="h-4 w-4" /> Pay via Secure Web Page
          </Button>
          <Button variant="outline" onClick={onCancel} className="h-12 w-full rounded-xl font-bold">
            Try Again
          </Button>
        </div>
      </StatusShell>
    );
  }

  if (phase === "otp") {
    return (
      <StatusShell tone="primary" icon={<Lock className="h-7 w-7" />} title="Verification Required">
        <p className="mt-2 text-sm text-muted-foreground">
          Please enter the OTP or Voucher Code sent to your mobile number ({momoNumber}).
        </p>
        {errorMsg && <p className="mt-3 text-sm font-bold text-rose-500">{errorMsg}</p>}

        <div className="mt-6 space-y-4">
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={otp} onChange={onOtpChange}>
              <InputOTPGroup className="gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className="h-12 w-11 rounded-xl border border-border bg-background text-lg font-bold first:rounded-xl last:rounded-xl"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={onCancel} className="h-auto p-0 text-xs font-bold text-muted-foreground">
              Cancel Order
            </Button>
            {otpTimer > 0 ? (
              <span className="text-xs text-muted-foreground">
                Resend in <span className="font-bold text-foreground tabular-nums">{otpTimer}s</span>
              </span>
            ) : (
              <Button variant="ghost" onClick={onResendOtp} className="h-auto p-0 text-xs font-bold text-foreground hover:underline">
                Try again
              </Button>
            )}
          </div>

          <Button
            id="btn-agent-otp-submit"
            onClick={onSubmitOtp}
            disabled={otp.length < 4}
            className="h-12 w-full rounded-xl font-bold"
          >
            Verify OTP
          </Button>
        </div>
      </StatusShell>
    );
  }

  const delivering = phase === "delivering";
  return (
    <StatusShell
      tone={delivering ? "emerald" : "primary"}
      icon={delivering ? <CheckCircle2 className="h-8 w-8" /> : <Loader2 className="h-8 w-8 animate-spin" />}
      title={
        phase === "processing"
          ? "Initiating Payment..."
          : phase === "polling"
            ? "Awaiting Authorization"
            : "Payment Received! Sending Data..."
      }
    >
      {phase === "polling" && (
        <div className="mt-4 inline-flex items-center gap-2.5 rounded-xl border border-border bg-secondary/40 px-4 py-2.5 text-sm font-semibold text-foreground">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          {authMessage || `Please check your phone (${momoNumber}) to authorize...`}
        </div>
      )}
      {delivering && (
        <p className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          Connecting to {networkName} network to deliver your bundle.
        </p>
      )}
      <p className="mt-5 text-xs text-muted-foreground">
        Do not close this window. Your bundle will be delivered automatically.
      </p>
    </StatusShell>
  );
}
