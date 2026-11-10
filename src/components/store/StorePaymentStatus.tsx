import { PaymentFailed, PaymentOtp, PaymentProgress, PaymentReceipt } from "@/components/checkout/PaymentScreens";

export type StorePaymentPhase = "processing" | "otp" | "polling" | "delivering" | "success" | "error";

export function StorePaymentStatus({
  phase,
  phone,
  momoNumber,
  momoNetwork,
  bundleLabel,
  networkName,
  amount,
  paidWithWallet,
  reference,
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
  onTrack,
}: {
  phase: StorePaymentPhase;
  phone: string;
  momoNumber: string;
  momoNetwork: string;
  bundleLabel?: string;
  networkName?: string | null;
  amount: string;
  paidWithWallet: boolean;
  reference?: string | null;
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
  onTrack: () => void;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {phase === "success" && (
          <PaymentReceipt
            lead={
              <>
                Your <span className="font-semibold text-foreground">{bundleLabel}</span> is on its way to{" "}
                <span className="font-semibold text-foreground">{phone}</span>.
              </>
            }
            amount={amount}
            showDelivery
            rows={[
              { label: "Network", value: networkName },
              { label: "Paid with", value: paidWithWallet ? "Wallet" : `MoMo (${momoNetwork})` },
            ]}
            reference={reference}
            primary={{ label: "Track Order", onClick: onTrack }}
            secondary={{ label: "Buy Again", onClick: onReturnToStore }}
          />
        )}

        {phase === "error" && (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <PaymentFailed message={errorMsg} networkCode={paidWithWallet ? null : momoNetwork} onPayOnline={onPayWithRedirect} onRetry={onCancel} />
          </div>
        )}

        {phase === "otp" && (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <PaymentOtp
              phone={momoNumber}
              value={otp}
              onChange={onOtpChange}
              onSubmit={onSubmitOtp}
              onCancel={onCancel}
              onResend={onResendOtp}
              resendInSeconds={otpTimer}
              error={errorMsg}
              submitId="btn-agent-otp-submit"
            />
          </div>
        )}

        {(phase === "processing" || phase === "polling" || phase === "delivering") && (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <PaymentProgress stage={phase} message={authMessage} networkCode={momoNetwork} deliveringLabel="Sending your data" showApprovalHelp={!paidWithWallet} />
          </div>
        )}
      </div>
    </div>
  );
}
