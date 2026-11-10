import { Loader2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function RewardsDialog({
  open,
  onOpenChange,
  phone,
  onPhoneChange,
  pointsBalance,
  isChecking,
  onCheck,
  onRedeem,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
  pointsBalance: number | null;
  isChecking: boolean;
  onCheck: () => void;
  onRedeem: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-500">
            <Trophy className="h-6 w-6" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-left text-lg font-bold text-foreground">Loyalty Rewards Hub</DialogTitle>
            <DialogDescription className="text-left text-xs text-muted-foreground">
              Earn GigPoints on every purchase and redeem checkout discounts!
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 border-t border-border pt-4">
          <div>
            <label htmlFor="store-loyalty-phone" className="mb-1.5 block text-xs font-bold text-muted-foreground">
              Enter your phone number to check balance:
            </label>
            <div className="flex gap-2">
              <Input
                id="store-loyalty-phone"
                inputMode="tel"
                placeholder="024 123 4567"
                value={phone}
                onChange={(e) => onPhoneChange(e.target.value)}
                className="h-11 flex-1 rounded-xl text-sm font-semibold"
              />
              <Button onClick={onCheck} disabled={isChecking || !phone.trim()} className="h-11 rounded-xl text-xs font-bold">
                {isChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
              </Button>
            </div>
          </div>

          {pointsBalance !== null && (
            <div className="space-y-2 rounded-2xl border border-border bg-secondary/40 p-4 text-center animate-in fade-in duration-300">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Your Balance</p>
              <p className="text-3xl font-bold tabular-nums text-foreground">
                {pointsBalance} <span className="text-xs font-bold text-muted-foreground">GigPoints</span>
              </p>

              {pointsBalance >= 10 ? (
                <div className="pt-2">
                  <p className="mb-3 text-xs text-muted-foreground">
                    Redeem 10 points for GH₵ 1.00 off! (Max discount: bundle price minus GH₵ 1.00)
                  </p>
                  <Button onClick={onRedeem} className="h-10 w-full rounded-xl text-xs font-bold">
                    Redeem Discount Now
                  </Button>
                </div>
              ) : (
                <p className="pt-1 text-xs text-muted-foreground">You need at least 10 points to redeem a discount.</p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
