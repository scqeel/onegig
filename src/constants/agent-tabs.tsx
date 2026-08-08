import React from "react";
import {
  BarChart3, Gift, Globe, Layers, Megaphone, ShoppingCart, Signal,
  Store, Trophy, Users, Wallet,
} from "lucide-react";

export type AgentTab =
  | "buy"
  | "store"
  | "marketing"
  | "leaderboard"
  | "transactions"
  | "customers"
  | "withdrawals"
  | "sub_agents"
  | "settings";

export const ALL_TABS: { value: AgentTab; label: string; icon: React.ReactNode }[] = [
  { value: "buy",          label: "Sell Data & Bills (POS)", icon: <Signal className="h-4 w-4" /> },
  { value: "store",        label: "My Store",                icon: <Store className="h-4 w-4" /> },
  { value: "marketing",    label: "Marketing Kit",           icon: <Megaphone className="h-4 w-4" /> },
  { value: "leaderboard",  label: "Leaderboard",             icon: <Trophy className="h-4 w-4" /> },
  { value: "transactions", label: "Transactions",            icon: <ShoppingCart className="h-4 w-4" /> },
  { value: "customers",    label: "Customer CRM",            icon: <Users className="h-4 w-4" /> },
  { value: "withdrawals",  label: "Wallet & Cashout",        icon: <Wallet className="h-4 w-4" /> },
  { value: "sub_agents",   label: "Sub-Agents",              icon: <Globe className="h-4 w-4" /> },
  { value: "settings",     label: "Store Settings",          icon: <Layers className="h-4 w-4" /> },
];
