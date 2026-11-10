import { ReactNode, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Copy, CreditCard, Loader2, Lock, Smartphone, XCircle } from "lucide-react";
import { Confetti } from "@/components/Confetti";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";

const SCREEN = "mx-auto w-full max-w-md animate-in fade-in duration-300";
const LABEL = "text-[10px] font-bold uppercase tracking-wider text-muted-foreground";

export function getApprovalInstructions(netCode?: string | null) {
  const code = String(netCode || "MTN").toUpperCase();
  if (code === "MTN") return "Dial *170# > Option 6 (My Wallet) > Option 3 (Approvals) to approve.";
  if (code === "TELECEL" || code === "VODAFONE" || code === "VODA") {
    return "Dial *110# > Option 4 (Make Payment) > Option 2 (My Approvals) to approve.";
  }
  return "Dial *110# and check your Approvals menu to authorize the payment.";
}

function StatusIcon({ tone, children }: { tone: "emerald" | "rose" | "primary"; children: ReactNode }) {
  const tones = {
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
    rose: "border-rose-500/20 bg-rose-500/10 text-rose-500",
    primary: "border-primary/20 bg-primary/10 text-primary",
  };
  return <div className={cn("mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border", tones[tone])}>{children}</div>;
}

function ApprovalHelp({ networkCode }: { networkCode?: string | null }) {
  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-left">
      <p className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
        <Smartphone className="h-3.5 w-3.5" /> Didn't get the prompt?
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{getApprovalInstructions(networkCode)}</p>
    </div>
  );
}

/** Shown between tapping Pay and the money clearing, so the buyer always knows what's happening. */
export function PaymentProgress({
  stage,
  title,
  message,
  networkCode,
  deliveringLabel = "Sending your order",
  showApprovalHelp = true,
}: {
  stage: "processing" | "polling" | "delivering";
  title?: string;
  message?: string | null;
  networkCode?: string | null;
  deliveringLabel?: string;
  showApprovalHelp?: boolean;
}) {
  const order = ["processing", "polling", "delivering"];
  const current = order.indexOf(stage);
  const steps = ["Starting payment", "Approve on your phone", deliveringLabel];
  const headings = { processing: "Starting your payment", polling: "Approve on your phone", delivering: deliveringLabel };
  const fallback = {
    processing: "A payment prompt is on its way to your phone.",
    polling: "Check your phone and enter your MoMo PIN to finish.",
    delivering: "Payment received. Finishing your order now.",
  };

  return (
    <div className={cn(SCREEN, "space-y-5 py-4 text-center")}>
      <StatusIcon tone={stage === "delivering" ? "emerald" : "primary"}>
        <Loader2 className="h-7 w-7 animate-spin" />
      </StatusIcon>
      <div>
        <h3 className="text-xl font-bold text-foreground">{title ?? headings[stage]}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{message || fallback[stage]}</p>
      </div>

      <ol className="space-y-2.5 rounded-xl border border-border bg-background p-4 text-left">
        {steps.map((label, i) => (
          <li key={label} className="flex items-center gap-3 text-sm">
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                i < current && "bg-primary text-primary-foreground",
                i === current && "border-2 border-primary text-foreground",
                i > current && "border border-border text-muted-foreground",
              )}
            >
              {i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cn(i === current ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</span>
          </li>
        ))}
      </ol>

      {stage === "polling" && showApprovalHelp && <ApprovalHelp networkCode={networkCode} />}
      <p className="text-xs text-muted-foreground">Please keep this page open.</p>
    </div>
  );
}

export function PaymentOtp({
  phone,
  value,
  onChange,
  onSubmit,
  onCancel,
  onResend,
  resendInSeconds = 0,
  error,
  submitId,
}: {
  phone: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onResend: () => void;
  resendInSeconds?: number;
  error?: string | null;
  submitId?: string;
}) {
  return (
    <div className={cn(SCREEN, "space-y-5 py-4 text-center")}>
      <StatusIcon tone="primary"><Lock className="h-6 w-6" /></StatusIcon>
      <div>
        <h3 className="text-xl font-bold text-foreground">Enter your code</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          We sent an OTP or voucher code to <span className="font-semibold text-foreground">{phone}</span>.
        </p>
      </div>

      {error && <p className="text-sm font-semibold text-rose-500">{error}</p>}

      <div className="flex justify-center">
        <InputOTP maxLength={6} value={value} onChange={onChange}>
          <InputOTPGroup className="gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot key={i} index={i} className="h-12 w-11 rounded-xl border border-border bg-background text-lg font-bold first:rounded-xl last:rounded-xl" />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      <Button id={submitId} onClick={onSubmit} disabled={value.length < 4} className="h-12 w-full rounded-xl font-bold">
        Verify and Pay
      </Button>

      <div className="flex items-center justify-between text-xs font-semibold">
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">Cancel order</button>
        {resendInSeconds > 0 ? (
          <span className="text-muted-foreground">Resend in <span className="tabular-nums text-foreground">{resendInSeconds}s</span></span>
        ) : (
          <button type="button" onClick={onResend} className="text-foreground hover:underline">Send a new code</button>
        )}
      </div>
    </div>
  );
}

export function PaymentFailed({
  title = "Payment Failed",
  message,
  networkCode,
  onPayOnline,
  onRetry,
}: {
  title?: string;
  message?: string | null;
  networkCode?: string | null;
  onPayOnline?: () => void;
  onRetry: () => void;
}) {
  return (
    <div className={cn(SCREEN, "space-y-5 py-4 text-center")}>
      <StatusIcon tone="rose"><XCircle className="h-7 w-7" /></StatusIcon>
      <div>
        <h3 className="text-xl font-bold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{message || "We couldn't complete this payment. Please try again."}</p>
      </div>

      {networkCode && <ApprovalHelp networkCode={networkCode} />}

      <div className="space-y-2.5">
        <Button onClick={onRetry} className="h-12 w-full rounded-xl font-bold">Try Again</Button>
        {onPayOnline && (
          <Button onClick={onPayOnline} variant="outline" className="h-12 w-full gap-2 rounded-xl font-bold">
            <CreditCard className="h-4 w-4" /> Pay via Secure Web Page
          </Button>
        )}
      </div>
    </div>
  );
}

function CopyReference({ reference }: { reference: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy reference"
      onClick={() => {
        navigator.clipboard.writeText(reference);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex min-w-0 items-center gap-1.5 font-mono text-xs font-semibold text-foreground"
    >
      <span className="truncate">{reference}</span>
      {copied ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
    </button>
  );
}

/** The confirmation every purchase ends on. */
export function PaymentReceipt({
  title = "Payment Successful",
  lead,
  amount,
  rows = [],
  reference,
  showDelivery,
  note,
  primary,
  secondary,
  children,
}: {
  title?: string;
  lead: ReactNode;
  amount: string;
  rows?: { label: string; value: ReactNode }[];
  reference?: string | null;
  showDelivery?: boolean;
  note?: string;
  primary: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
  children?: ReactNode;
}) {
  const delivery = [
    { label: "Paid", done: true },
    { label: "Sending", done: false, current: true },
    { label: "Delivered", done: false },
  ];

  return (
    <div className={cn(SCREEN, "relative space-y-4 py-2")}>
      <Confetti />

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="px-5 pb-5 pt-6 text-center">
          <StatusIcon tone="emerald"><CheckCircle2 className="h-7 w-7" /></StatusIcon>
          <h3 className="mt-3 text-xl font-bold text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{lead}</p>
          <p className="mt-3 text-3xl font-bold tabular-nums text-foreground">{amount}</p>
        </div>

        {showDelivery && (
          <ol className="flex items-start border-t border-border px-5 py-4">
            {delivery.map((step, i) => (
              <li key={step.label} className="relative flex flex-1 flex-col items-center gap-1.5">
                {i > 0 && <span className={cn("absolute right-1/2 top-3 h-0.5 w-full -translate-y-1/2", step.done || step.current ? "bg-primary" : "bg-border")} />}
                <span
                  className={cn(
                    "relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-card",
                    step.done && "bg-primary text-primary-foreground",
                    step.current && "border-2 border-primary text-foreground",
                    !step.done && !step.current && "border border-border text-muted-foreground",
                  )}
                >
                  {step.done ? <Check className="h-3.5 w-3.5" /> : step.current ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-border" />}
                </span>
                <span className={cn("text-[11px]", step.current || step.done ? "font-semibold text-foreground" : "text-muted-foreground")}>{step.label}</span>
              </li>
            ))}
          </ol>
        )}

        {(rows.length > 0 || reference) && (
          <dl className="space-y-2.5 border-t border-dashed border-border px-5 py-4 text-sm">
            {rows.map((row) => (
              <div key={row.label} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="min-w-0 truncate text-right font-semibold text-foreground">{row.value}</dd>
              </div>
            ))}
            {reference && (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Reference</dt>
                <dd className="min-w-0"><CopyReference reference={reference} /></dd>
              </div>
            )}
          </dl>
        )}

        {children && <div className="border-t border-border p-4">{children}</div>}
      </div>

      {note && (
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {note}
        </p>
      )}

      <div className={cn("grid gap-2.5", secondary && "grid-cols-2")}>
        {secondary && (
          <Button variant="outline" onClick={secondary.onClick} className="h-12 rounded-xl font-bold">{secondary.label}</Button>
        )}
        <Button onClick={primary.onClick} className="h-12 rounded-xl font-bold">{primary.label}</Button>
      </div>
    </div>
  );
}
