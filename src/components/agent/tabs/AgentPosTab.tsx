import { useState } from "react";
import { Signal, Smartphone, Tv, Zap } from "lucide-react";
import { BuyDataFlow } from "@/components/buy/BuyDataFlow";
import { BuyAirtimeFlow } from "@/components/buy/BuyAirtimeFlow";
import { PayBillsFlow } from "@/components/buy/PayBillsFlow";
import { useAgentBundles } from "@/hooks/useNetworksAndBundles";
import { cn } from "@/lib/utils";

export function AgentPosTab({ agentProfile }: { agentProfile: any }) {
  const { data: myPrices } = useAgentBundles(agentProfile.id);
  const [activeTab, setActiveTab] = useState<"data" | "airtime" | "bill">("data");

  const getHeaderInfo = () => {
    switch (activeTab) {
      case "airtime":
        return {
          title: "Sell Airtime (POS)",
          desc: "Sell instant airtime top-ups to MTN, Telecel, and AirtelTigo lines."
        };
      case "bill":
        return {
          title: "Utility Bill Payment (POS)",
          desc: "Pay DSTV, GOTV, StarTimes bills & ECG Prepaid meters for customers."
        };
      default:
        return {
          title: "Sell Mobile Data (POS)",
          desc: "Purchases here apply your retail pricing and generate store analytics."
        };
    }
  };

  const header = getHeaderInfo();

  return (
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft animate-in fade-in duration-300">
      {/* Card Header */}
      <div className="border-b border-border/60 bg-[#080c1a] px-5 py-4 md:px-6">
        <h2 className="text-base font-bold text-white transition-all duration-300">{header.title}</h2>
        <p className="mt-0.5 text-xs text-white/50 transition-all duration-300">{header.desc}</p>
      </div>

      {/* Tab Switcher Headers */}
      <div className="border-b border-border/40 bg-secondary/5 dark:bg-slate-900/5 p-2 flex gap-1">
        {[
          { id: "data", label: "Sell Data", icon: Zap },
          { id: "airtime", label: "Sell Airtime", icon: Smartphone },
          { id: "bill", label: "Pay Bills", icon: Tv }
        ].map((t) => {
          const Icon = t.icon as any;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={cn(
                "flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs transition-all duration-150",
                activeTab === t.id
                  ? "bg-slate-950 text-white shadow-float border border-slate-800"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/15 dark:hover:bg-slate-900/15"
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", activeTab === t.id ? "text-primary" : "text-slate-400")} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Dynamic Tab Content */}
      <div className="p-5 md:p-6">
        {activeTab === "data" && <BuyDataFlow agentSlug={agentProfile.store_slug} priceOverrides={myPrices || undefined} />}
        {activeTab === "airtime" && <BuyAirtimeFlow agentSlug={agentProfile.store_slug} />}
        {activeTab === "bill" && <PayBillsFlow agentSlug={agentProfile.store_slug} />}
      </div>
    </div>
  );
}
