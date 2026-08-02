import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Smartphone, CheckCircle2, ShieldCheck, AlertTriangle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface VerifiedPhoneInputProps {
  value: string;
  onChange: (val: string) => void;
  networkCode?: string;
  placeholder?: string;
  label?: string;
  className?: string;
  showAccountName?: boolean;
}

export const VerifiedPhoneInput: React.FC<VerifiedPhoneInputProps> = ({
  value,
  onChange,
  networkCode,
  placeholder = "e.g. 024 123 4567",
  label = "Recipient Phone Number",
  className = "",
  showAccountName = true,
}) => {
  const [verifying, setVerifying] = useState(false);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [datahubStatus, setDatahubStatus] = useState<{
    verified: boolean;
    message: string;
  } | null>(null);

  const cleanNum = (numStr: string) => {
    let num = numStr.replace(/\D/g, "");
    if (num.startsWith("233") && num.length > 9) {
      num = "0" + num.slice(3);
    } else if (num.startsWith("00233") && num.length > 11) {
      num = "0" + num.slice(5);
    } else if (!num.startsWith("0") && num.length === 9) {
      num = "0" + num;
    }
    return num;
  };

  useEffect(() => {
    const num = cleanNum(value);
    if (num.length !== 10) {
      setAccountName(null);
      setDatahubStatus(null);
      setVerifying(false);
      return;
    }

    setVerifying(true);
    const timer = setTimeout(async () => {
      try {
        // 1. Resolve MoMo account name via paystack-resolve
        if (showAccountName && networkCode) {
          const { data: paystackData } = await supabase.functions.invoke("paystack-resolve", {
            body: { momo_number: num, momo_network: networkCode },
          });
          if (paystackData?.ok && paystackData?.account_name) {
            setAccountName(paystackData.account_name);
          } else {
            setAccountName(null);
          }
        }

        // 2. Perform DataHub beneficiary check for MTN numbers or general network verify
        const netUpper = (networkCode || "").toUpperCase();
        if (netUpper === "MTN" || !networkCode) {
          const { data: dhData, error: dhErr } = await supabase.functions.invoke("admin-provider-action", {
            body: { action: "verify_number", phone: num, is_ported_number: true },
          });

          if (!dhErr && (dhData?.success || dhData?.data?.exists)) {
            setDatahubStatus({
              verified: true,
              message: "Verified MTN Beneficiary — Instant ⚡ Delivery Ready",
            });
          } else if (!dhErr && (dhData?.message || dhData?.error)) {
            setDatahubStatus({
              verified: false,
              message: dhData?.message || dhData?.error || "Number recorded for beneficiary processing.",
            });
          } else {
            setDatahubStatus(null);
          }
        }
      } catch (err) {
        console.error("Number verification error:", err);
      } finally {
        setVerifying(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [value, networkCode, showAccountName]);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
            {label}
          </label>
          {datahubStatus?.verified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="h-3 w-3" /> Beneficiary Verified
            </span>
          )}
        </div>
      )}

      <div className="relative group">
        <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400 group-focus-within:text-emerald-400 transition-colors" />
        <Input
          type="tel"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "h-12 w-full rounded-xl border border-slate-800 bg-[#0b1021] pl-10 pr-10 text-sm font-bold text-slate-100 placeholder:text-slate-500 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all",
            datahubStatus?.verified && "border-emerald-500/40 bg-emerald-950/10"
          )}
        />
        {verifying && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
            <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
          </div>
        )}
        {!verifying && datahubStatus?.verified && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" />
          </div>
        )}
      </div>

      {/* Account Name & Beneficiary Status Pill */}
      {(accountName || datahubStatus) && (
        <div className="space-y-1 pt-0.5">
          {accountName && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 px-1">
              <span className="text-slate-500">Account Name:</span>
              <span className="text-emerald-400">{accountName}</span>
            </div>
          )}
          {datahubStatus && (
            <div
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black shadow-md ${
                datahubStatus.verified
                  ? "border-emerald-600/50 bg-emerald-500/20 text-emerald-950 dark:text-emerald-300 dark:bg-emerald-950/90 dark:border-emerald-500/40"
                  : "border-amber-600/50 bg-amber-500/20 text-amber-950 dark:text-amber-300 dark:bg-amber-950/90 dark:border-amber-500/40"
              }`}
            >
              {datahubStatus.verified ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              )}
              <span>{datahubStatus.message}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
