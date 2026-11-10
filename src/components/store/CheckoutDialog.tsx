import { Gift, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NetworkTag } from "@/components/buy/BundleCard";
import {
  CheckoutSection,
  CheckoutSheet,
  MomoNumberFields,
  PaymentMethodPicker,
} from "@/components/checkout/CheckoutSheet";
import { formatGHS } from "@/lib/format";
import { cn } from "@/lib/utils";

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
  networkCode,
  bundlePrice,
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
  walletBalanceLabel,
  onPay,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundleLabel?: string;
  networkName?: string;
  networkCode?: string;
  bundlePrice: number;
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
  walletBalanceLabel: string;
  onPay: () => void;
}) {
  const payDisabled =
    !hasBundle ||
    phone.replace(/\D/g, "").length < 9 ||
    (!payWithWallet && momoNumber.replace(/\D/g, "").length < 9) ||
    isVerifying;

  const discount = bundlePrice - finalPrice;

  return (
    <CheckoutSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Confirm Order"
      description="Please review purchase details before paying."
      productLabel={`${networkName ?? ""} bundle`}
      productName={bundleLabel}
      productTag={<NetworkTag code={networkCode} />}
      rows={[
        { label: "Price", value: formatGHS(bundlePrice) },
        ...(discount > 0 ? [{ label: "Discount", value: `-${formatGHS(discount)}` }] : []),
      ]}
      total={formatGHS(finalPrice)}
      payLabel={`Pay ${hasBundle ? formatGHS(finalPrice) : ""}`}
      payIcon={<Zap className="h-4 w-4" />}
      onPay={onPay}
      payDisabled={payDisabled}
    >
      <CheckoutSection
        label="Who is receiving the data?"
        action={
          crmCustomers && crmCustomers.length > 0 ? (
            <select
              aria-label="Select from Address Book"
              className="max-w-[150px] cursor-pointer appearance-none truncate bg-transparent text-[11px] font-bold text-foreground underline outline-none"
              onChange={(e) => {
                if (e.target.value) onPhoneChange(e.target.value);
              }}
            >
              <option value="">Address Book</option>
              {crmCustomers.map((c) => (
                <option key={c.id} value={c.phone}>
                  {c.name} ({c.phone})
                </option>
              ))}
            </select>
          ) : undefined
        }
      >
        <Input
          id="store-recipient"
          aria-label="Recipient phone"
          inputMode="tel"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="024 123 4567"
          className="h-12 rounded-xl text-base font-semibold"
        />
      </CheckoutSection>

      {canPayWithWallet && (
        <PaymentMethodPicker payWithWallet={payWithWallet} onChange={onPayWithWalletChange} balanceLabel={walletBalanceLabel} />
      )}

      {!payWithWallet && (
        <MomoNumberFields
          network={momoNetwork}
          onNetworkChange={onMomoNetworkChange}
          number={momoNumber}
          onNumberChange={onMomoNumberChange}
          isVerifying={isVerifying}
          accountName={accountName}
          hint="The payment prompt will be sent to this number."
        />
      )}

      <CheckoutSection label="Promo code or gift voucher">
        {appliedCoupon ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="flex min-w-0 items-center gap-1.5">
              <Gift className="h-4 w-4 shrink-0" />
              <span className="truncate">
                <span className="font-mono uppercase text-foreground">{appliedCoupon.code}</span> saves {formatGHS(Number(appliedCoupon.discount_amount))}
              </span>
            </span>
            <Button variant="ghost" onClick={onRemoveCoupon} className="h-6 px-1.5 text-[11px] font-bold">
              Remove
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              id="store-coupon"
              aria-label="Promo code"
              placeholder="e.g. WELCOME5"
              value={couponCodeInput}
              onChange={(e) => onCouponCodeInputChange(e.target.value)}
              className="h-11 flex-1 rounded-xl text-sm font-semibold uppercase"
            />
            <Button variant="secondary" onClick={onApplyCoupon} disabled={isCheckingCoupon || !couponCodeInput.trim()} className="h-11 rounded-xl px-4 text-xs font-bold">
              {isCheckingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
            </Button>
          </div>
        )}
        {couponError && <p className="text-xs font-semibold text-rose-500">{couponError}</p>}
      </CheckoutSection>

      <div className="space-y-2.5 rounded-xl border border-border bg-background p-3">
        <label htmlFor="auto-bill-checkbox" className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            id="auto-bill-checkbox"
            checked={subscribeChecked}
            onChange={(e) => onSubscribeCheckedChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
          />
          <span className="text-xs font-bold text-foreground">
            Auto-Pilot recurring topup
            <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
              Automatically deliver this bundle and bill my mobile money wallet. Cancel anytime.
            </span>
          </span>
        </label>

        {subscribeChecked && (
          <div className="flex gap-1 rounded-lg bg-secondary p-0.5">
            {(["weekly", "monthly"] as const).map((freq) => (
              <button
                key={freq}
                type="button"
                aria-pressed={subscriptionFrequency === freq}
                onClick={() => onSubscriptionFrequencyChange(freq)}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors",
                  subscriptionFrequency === freq ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Every {freq === "weekly" ? "Week" : "Month"}
              </button>
            ))}
          </div>
        )}
      </div>
    </CheckoutSheet>
  );
}
