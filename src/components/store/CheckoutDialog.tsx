import { CheckCircle2, Gift, Loader2, Lock, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatGHS } from "@/lib/format";
import { cn } from "@/lib/utils";

const FIELD_LABEL = "mb-1.5 block text-xs font-bold text-muted-foreground";
const FIELD_HINT = "mt-1 text-[10px] font-medium text-muted-foreground";
const SECTION = "border-t border-border pt-3";

interface CrmCustomer {
  id: string;
  name: string;
  phone: string;
}

export function CheckoutDialog({
  open,
  onOpenChange,
  bundleLabel,
  networkName,
  finalPrice,
  hasBundle,
  phone,
  onPhoneChange,
  crmCustomers,
  momoNumber,
  onMomoNumberChange,
  momoNetwork,
  onMomoNetworkChange,
  isVerifying,
  accountName,
  couponCodeInput,
  onCouponCodeInputChange,
  appliedCoupon,
  couponError,
  isCheckingCoupon,
  onApplyCoupon,
  onRemoveCoupon,
  subscribeChecked,
  onSubscribeCheckedChange,
  subscriptionFrequency,
  onSubscriptionFrequencyChange,
  canPayWithWallet,
  payWithWallet,
  onPayWithWalletChange,
  walletDetail,
  onPay,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundleLabel?: string;
  networkName?: string;
  finalPrice: number;
  hasBundle: boolean;
  phone: string;
  onPhoneChange: (value: string) => void;
  crmCustomers?: CrmCustomer[] | null;
  momoNumber: string;
  onMomoNumberChange: (value: string) => void;
  momoNetwork: string;
  onMomoNetworkChange: (value: string) => void;
  isVerifying: boolean;
  accountName: string | null;
  couponCodeInput: string;
  onCouponCodeInputChange: (value: string) => void;
  appliedCoupon: { code: string; discount_amount: number | string } | null;
  couponError: string | null;
  isCheckingCoupon: boolean;
  onApplyCoupon: () => void;
  onRemoveCoupon: () => void;
  subscribeChecked: boolean;
  onSubscribeCheckedChange: (checked: boolean) => void;
  subscriptionFrequency: "weekly" | "monthly";
  onSubscriptionFrequencyChange: (frequency: "weekly" | "monthly") => void;
  canPayWithWallet: boolean;
  payWithWallet: boolean;
  onPayWithWalletChange: (checked: boolean) => void;
  walletDetail: string;
  onPay: () => void;
}) {
  const payDisabled =
    !hasBundle ||
    phone.replace(/\D/g, "").length < 9 ||
    (!payWithWallet && momoNumber.replace(/\D/g, "").length < 9) ||
    isVerifying;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] max-w-sm max-h-[90dvh] overflow-y-auto rounded-2xl border border-border bg-card p-0">
        <div className="border-b border-border bg-secondary/40 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-left text-lg font-bold text-foreground">
              <Sparkles className="h-4 w-4 text-amber-500" /> Confirm Order
            </DialogTitle>
            <DialogDescription className="text-left text-xs text-muted-foreground">
              Please review purchase details before paying.
            </DialogDescription>
          </DialogHeader>

          {bundleLabel && networkName && (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{networkName} bundle</p>
                <p className="text-2xl font-bold leading-tight text-foreground">{bundleLabel}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total</p>
                <p className="text-2xl font-bold tabular-nums text-foreground">{formatGHS(finalPrice)}</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label htmlFor="store-recipient" className="block text-xs font-bold text-muted-foreground">
                Recipient Phone (Who is receiving the data?)
              </label>
              {crmCustomers && crmCustomers.length > 0 && (
                <select
                  aria-label="Select from Address Book"
                  className="cursor-pointer appearance-none border-b border-border bg-transparent pb-0.5 text-[10px] font-bold text-foreground outline-none"
                  onChange={(e) => {
                    if (e.target.value) onPhoneChange(e.target.value);
                  }}
                >
                  <option value="">Select from Address Book</option>
                  {crmCustomers.map((c) => (
                    <option key={c.id} value={c.phone}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <Input
              id="store-recipient"
              inputMode="tel"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              placeholder="024 123 4567"
              className="h-12 rounded-xl text-base font-semibold"
            />
            <p className={FIELD_HINT}>Data bundle will be automatically credited to this number.</p>
          </div>

          {!payWithWallet && (
            <div>
              <label htmlFor="store-momo" className={FIELD_LABEL}>
                Payment Mobile Money Number (Who is paying?)
              </label>
              <div className="flex gap-2">
                <select
                  aria-label="Mobile money network"
                  className="h-12 w-[100px] rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={momoNetwork}
                  onChange={(e) => onMomoNetworkChange(e.target.value)}
                >
                  <option value="MTN">MTN</option>
                  <option value="TELECEL">Telecel</option>
                  <option value="AIRTELTIGO">AT</option>
                </select>
                <Input
                  id="store-momo"
                  inputMode="tel"
                  value={momoNumber}
                  onChange={(e) => onMomoNumberChange(e.target.value)}
                  placeholder="024 123 4567"
                  className="h-12 flex-1 rounded-xl text-base font-semibold"
                />
              </div>
              <p className={FIELD_HINT}>The prompt will be sent to this number.</p>
              {isVerifying && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Verifying account...
                </div>
              )}
              {accountName && !isVerifying && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  {accountName}
                </div>
              )}
            </div>
          )}

          <div className={SECTION}>
            <label htmlFor="store-coupon" className={FIELD_LABEL}>
              Promo Code or Gift Voucher
            </label>
            {appliedCoupon ? (
              <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <div className="flex items-center gap-1.5">
                  <Gift className="h-4 w-4" />
                  <span>
                    Applied: <span className="font-mono uppercase text-foreground">{appliedCoupon.code}</span> (-GH₵{" "}
                    {Number(appliedCoupon.discount_amount).toFixed(2)})
                  </span>
                </div>
                <Button variant="ghost" onClick={onRemoveCoupon} className="h-6 px-1.5 text-[10px] font-bold">
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  id="store-coupon"
                  placeholder="e.g. WELCOME5"
                  value={couponCodeInput}
                  onChange={(e) => onCouponCodeInputChange(e.target.value)}
                  className="h-11 flex-1 rounded-xl text-sm font-semibold uppercase"
                />
                <Button
                  variant="secondary"
                  onClick={onApplyCoupon}
                  disabled={isCheckingCoupon || !couponCodeInput.trim()}
                  className="h-11 rounded-xl px-4 text-xs font-bold"
                >
                  {isCheckingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                </Button>
              </div>
            )}
            {couponError && <p className="mt-1 text-[10px] font-bold text-rose-500">{couponError}</p>}
          </div>

          <div className={cn(SECTION, "space-y-2.5")}>
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="auto-bill-checkbox"
                checked={subscribeChecked}
                onChange={(e) => onSubscribeCheckedChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
              />
              <label htmlFor="auto-bill-checkbox" className="cursor-pointer text-xs font-bold text-foreground">
                Auto-Pilot recurring topup 🔄
                <span className="mt-0.5 block text-[10px] font-medium text-muted-foreground">
                  Automatically auto-deliver this bundle and bill my mobile money wallet. Cancel anytime.
                </span>
              </label>
            </div>

            {subscribeChecked && (
              <div className="flex gap-1 rounded-xl border border-border/40 bg-secondary/30 p-1 animate-in fade-in duration-300">
                {(["weekly", "monthly"] as const).map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    aria-pressed={subscriptionFrequency === freq}
                    onClick={() => onSubscriptionFrequencyChange(freq)}
                    className={cn(
                      "flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all",
                      subscriptionFrequency === freq
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                    )}
                  >
                    Every {freq === "weekly" ? "Week" : "Month"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {canPayWithWallet && (
            <div className={cn(SECTION, "flex items-start gap-2")}>
              <input
                type="checkbox"
                id="wallet-pay-checkbox"
                checked={payWithWallet}
                onChange={(e) => onPayWithWalletChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-emerald-500 accent-emerald-500"
              />
              <label htmlFor="wallet-pay-checkbox" className="cursor-pointer text-xs font-bold text-emerald-600 dark:text-emerald-400">
                Pay with Wallet Balance
                <span className="mt-0.5 block text-[10px] font-medium text-muted-foreground">{walletDetail}</span>
              </label>
            </div>
          )}

          <Button onClick={onPay} disabled={payDisabled} className="h-12 w-full rounded-xl text-xs font-bold uppercase">
            <Zap className="mr-1.5 h-3.5 w-3.5" /> Pay {hasBundle ? formatGHS(finalPrice) : ""}
          </Button>

          <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Secured Payments · PCI-DSS Certified
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
