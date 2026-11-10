import { ReactNode } from "react";
import { ChevronDown, CheckCircle2, Loader2, Lock, Smartphone, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const CHECKOUT_LABEL = "text-[10px] font-bold uppercase tracking-wider text-muted-foreground";

export interface CheckoutRow {
  label: string;
  value: ReactNode;
}

/** The one checkout used by every purchase. A bottom sheet on phones, a centred panel on desktop. */
export function CheckoutSheet({
  open,
  onOpenChange,
  title,
  description,
  productLabel,
  productName,
  productTag,
  rows,
  total,
  payLabel,
  payIcon,
  onPay,
  payDisabled,
  footerExtra,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  productLabel: string;
  productName: ReactNode;
  productTag?: ReactNode;
  rows: CheckoutRow[];
  total: string;
  payLabel: string;
  payIcon?: ReactNode;
  onPay: () => void;
  payDisabled?: boolean;
  footerExtra?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-full max-w-md flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-card p-0 max-sm:bottom-0 max-sm:left-0 max-sm:top-auto max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none">
        <div className="border-b border-border px-5 pb-4 pt-5">
          <DialogTitle className="pr-8 text-lg font-bold text-foreground">{title}</DialogTitle>
          <DialogDescription className="mt-0.5 text-xs text-muted-foreground">{description}</DialogDescription>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={CHECKOUT_LABEL}>{productLabel}</p>
                <p className="mt-0.5 truncate text-xl font-bold text-foreground">{productName}</p>
              </div>
              {productTag}
            </div>
            {rows.length > 0 && (
              <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs">
                {rows.map((row) => (
                  <div key={row.label} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="min-w-0 truncate text-right font-semibold tabular-nums text-foreground">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {children}
        </div>

        <div className="border-t border-border bg-card px-5 pb-5 pt-3.5">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-sm font-semibold text-muted-foreground">Total to pay</span>
            <span className="text-2xl font-bold tabular-nums text-foreground">{total}</span>
          </div>
          <Button onClick={onPay} disabled={payDisabled} className="h-12 w-full gap-2 rounded-xl text-sm font-bold">
            {payIcon}
            {payLabel}
          </Button>
          {footerExtra}
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <Lock className="h-3 w-3" /> Secured Payments · PCI-DSS Certified
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CheckoutSection({ label, action, children }: { label: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className={CHECKOUT_LABEL}>{label}</p>
        {action}
      </div>
      {children}
    </section>
  );
}

export function VerifiedName({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      <span className="truncate">{name}</span>
    </div>
  );
}

export function PaymentMethodPicker({
  payWithWallet,
  onChange,
  balanceLabel,
  walletDisabled,
  walletHint,
}: {
  payWithWallet: boolean;
  onChange: (payWithWallet: boolean) => void;
  balanceLabel: string;
  walletDisabled?: boolean;
  walletHint?: ReactNode;
}) {
  const option = (active: boolean, disabled?: boolean) =>
    cn(
      "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
      active ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border bg-background hover:bg-accent",
      disabled && "cursor-not-allowed opacity-50 hover:bg-background",
    );

  return (
    <CheckoutSection label="Pay with">
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" aria-pressed={!payWithWallet} onClick={() => onChange(false)} className={option(!payWithWallet)}>
          <Smartphone className="h-4 w-4 text-foreground" />
          <span className="text-xs font-bold text-foreground">Mobile Money</span>
          <span className="text-[10px] text-muted-foreground">Approve on your phone</span>
        </button>
        <button
          type="button"
          aria-pressed={payWithWallet}
          disabled={walletDisabled}
          onClick={() => onChange(true)}
          className={option(payWithWallet, walletDisabled)}
        >
          <Wallet className="h-4 w-4 text-foreground" />
          <span className="text-xs font-bold text-foreground">Wallet</span>
          <span className="text-[10px] tabular-nums text-muted-foreground">{walletDisabled ? `Low balance: ${balanceLabel}` : balanceLabel}</span>
        </button>
      </div>
      {walletHint}
    </CheckoutSection>
  );
}

/** Which mobile money number to charge. Omit `sameNumber` when the buyer must always type it. */
export function MomoNumberFields({
  sameNumber,
  onSameNumberChange,
  promptPhone,
  network,
  onNetworkChange,
  number,
  onNumberChange,
  atValue = "AIRTELTIGO",
  isVerifying,
  accountName,
  error,
  hint,
}: {
  sameNumber?: boolean;
  onSameNumberChange?: (same: boolean) => void;
  promptPhone?: string;
  network: string;
  onNetworkChange: (network: string) => void;
  number: string;
  onNumberChange: (number: string) => void;
  atValue?: string;
  isVerifying?: boolean;
  accountName?: string | null;
  error?: string | null;
  hint?: string;
}) {
  const hasChoice = sameNumber !== undefined && !!onSameNumberChange;
  const tab = (active: boolean) =>
    cn(
      "rounded-md px-2.5 py-1 text-[10px] font-bold transition-colors",
      active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <CheckoutSection
      label="MoMo number to charge"
      action={
        hasChoice ? (
          <div className="flex gap-1 rounded-lg bg-secondary p-0.5">
            <button type="button" aria-pressed={sameNumber} onClick={() => onSameNumberChange(true)} className={tab(sameNumber)}>
              Same number
            </button>
            <button type="button" aria-pressed={!sameNumber} onClick={() => onSameNumberChange(false)} className={tab(!sameNumber)}>
              Different
            </button>
          </div>
        ) : undefined
      }
    >
      {hasChoice && sameNumber ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">
          <Smartphone className="h-4 w-4 shrink-0" />
          <span>
            We'll send the payment prompt to <span className="font-semibold text-foreground">{promptPhone || "the number above"}</span>
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative w-[96px] shrink-0">
              <select
                aria-label="Mobile money network"
                value={network}
                onChange={(e) => onNetworkChange(e.target.value)}
                className="h-12 w-full cursor-pointer appearance-none rounded-xl border border-input bg-background pl-3 pr-7 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="MTN">MTN</option>
                <option value="TELECEL">Telecel</option>
                <option value={atValue}>AT</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
            <div className="relative flex-1">
              <Input
                aria-label="Mobile money number"
                inputMode="tel"
                value={number}
                onChange={(e) => onNumberChange(e.target.value)}
                placeholder="024 123 4567"
                className="h-12 rounded-xl pr-9 text-base font-semibold"
              />
              {isVerifying && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
            </div>
          </div>
          {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
          {accountName && !isVerifying && <VerifiedName name={accountName} />}
          {error && (
            <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>
          )}
        </div>
      )}
    </CheckoutSection>
  );
}
