import React from "react";
import { CheckCircle2, Clock, AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export type OrderStatusType = "pending" | "processing" | "delivered" | "failed" | "refunded" | "refund_requested" | string;

interface OrderStatusBadgeProps {
  status: OrderStatusType;
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
}

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({
  status,
  className,
  showIcon = true,
  size = "md",
}) => {
  const normalized = String(status || "pending").toLowerCase();

  const getStatusConfig = () => {
    switch (normalized) {
      case "delivered":
      case "success":
      case "completed":
        return {
          label: "Delivered",
          icon: CheckCircle2,
          styles:
            "border-emerald-600/40 bg-emerald-500/15 text-emerald-950 dark:text-emerald-300 dark:bg-emerald-950/90 dark:border-emerald-500/40",
          iconStyles: "text-emerald-600 dark:text-emerald-400",
        };
      case "processing":
        return {
          label: "Dispatching Data",
          icon: RefreshCw,
          spin: true,
          styles:
            "border-blue-600/40 bg-blue-500/15 text-blue-950 dark:text-blue-300 dark:bg-blue-950/90 dark:border-blue-500/40",
          iconStyles: "text-blue-600 dark:text-blue-400",
        };
      case "pending":
        return {
          label: "Order Placed",
          icon: Clock,
          styles:
            "border-amber-600/40 bg-amber-500/15 text-amber-950 dark:text-amber-300 dark:bg-amber-950/90 dark:border-amber-500/40",
          iconStyles: "text-amber-600 dark:text-amber-400",
        };
      case "refunded":
        return {
          label: "Refunded to Wallet",
          icon: RotateCcw,
          styles:
            "border-purple-600/40 bg-purple-500/15 text-purple-950 dark:text-purple-300 dark:bg-purple-950/90 dark:border-purple-500/40",
          iconStyles: "text-purple-600 dark:text-purple-400",
        };
      case "failed":
      case "rejected":
        return {
          label: "Failed & Refunded",
          icon: AlertTriangle,
          styles:
            "border-rose-600/40 bg-rose-500/15 text-rose-950 dark:text-rose-300 dark:bg-rose-950/90 dark:border-rose-500/40",
          iconStyles: "text-rose-600 dark:text-rose-400",
        };
      default:
        return {
          label: status,
          icon: Clock,
          styles:
            "border-slate-600/40 bg-slate-500/15 text-slate-950 dark:text-slate-300 dark:bg-slate-900/90 dark:border-slate-700",
          iconStyles: "text-slate-500 dark:text-slate-400",
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3.5 py-1.5 text-sm font-extrabold",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-black tracking-tight shadow-sm transition-all duration-200",
        config.styles,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && (
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            config.spin && "animate-spin",
            config.iconStyles
          )}
        />
      )}
      <span>{config.label}</span>
    </span>
  );
};
