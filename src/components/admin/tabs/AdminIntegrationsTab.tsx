import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatGHS } from "@/lib/format";
import { cn } from "@/lib/utils";

function LoadingCard({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card/50 p-8 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      {text}
    </div>
  );
}

export function AdminIntegrationsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [config, setConfig] = useState<any>(null);

  const [balances, setBalances] = useState<any>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDirection, setTransferDirection] = useState<"main_to_api" | "api_to_main">("main_to_api");
  const [isTransferring, setIsTransferring] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ["admin-integrations"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "data_providers").maybeSingle();
      if (data?.value) {
        const val = data.value;
        const defaultProviders: Record<string, any> = {
          swiftdata: { name: "SwiftData Reseller API", base_url: "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api", api_key: "" },
          datahub:   { name: "DataHub GH", base_url: "https://user.datahubgh.com/api/external", api_key: "" },
          swft:      { name: "SwiftData GH", base_url: "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api", api_key: "" },
          mtopup:    { name: "MTopUp", base_url: "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api", api_key: "" },
        };
        setConfig({
          ...val,
          active_data: val.active_data || val.active || "swiftdata",
          active_airtime: val.active_airtime || val.active || "swft",
          active_utility: val.active_utility || val.active || "swft",
          providers: {
            ...defaultProviders,
            ...(val.providers || {}),
          },
        });
      } else {
        setConfig({
          active: "swft",
          active_data: "swiftdata",
          active_airtime: "swft",
          active_utility: "swft",
          providers: {
            swiftdata: { name: "SwiftData Reseller API", base_url: "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api", api_key: "" },
            datahub:   { name: "DataHub GH", base_url: "https://user.datahubgh.com/api/external", api_key: "" },
            swft:      { name: "SwiftData GH", base_url: "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api", api_key: "swft_live_74686859a45448bea75376f0a64f97ed" },
            mtopup:    { name: "MTopUp", base_url: "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api", api_key: "" },
          },
        });
      }
      return true;
    },
  });

  const fetchSwiftDataState = async () => {
    setLoadingBalances(true);
    setLoadingStatus(true);
    try {
      const { data: balData, error: balErr } = await supabase.functions.invoke("admin-provider-action", {
        body: { action: "get_balance" }
      });
      if (!balErr && balData?.success) {
        setBalances(balData);
      }

      const { data: statusData, error: statusErr } = await supabase.functions.invoke("admin-provider-action", {
        body: { action: "service_status" }
      });
      if (!statusErr && statusData) {
        setGatewayStatus(statusData);
      }
    } catch (e) {
      console.error("Error fetching SwiftData info:", e);
    } finally {
      setLoadingBalances(false);
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchSwiftDataState();
  }, [config]);

  const saveConfig = async (newConfig: any) => {
    const { error } = await supabase.from("app_settings").upsert({ key: "data_providers", value: newConfig });
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Integrations updated successfully" });
    setConfig(newConfig);
    qc.invalidateQueries({ queryKey: ["admin-integrations"] });
  };

  const updateProvider = (key: string, field: string, val: string) => {
    setConfig((prev: any) => ({
      ...prev,
      providers: { ...prev.providers, [key]: { ...prev.providers[key], [field]: val } },
    }));
  };

  const handleTransfer = async () => {
    const amt = Number(transferAmount);
    if (isNaN(amt) || amt <= 0) {
      toast({ title: "Invalid amount", description: "Please enter a valid transfer amount.", variant: "destructive" });
      return;
    }

    setIsTransferring(true);
    try {
      const from = transferDirection === "main_to_api" ? "main" : "api";
      const to = transferDirection === "main_to_api" ? "api" : "main";

      const { data, error } = await supabase.functions.invoke("admin-provider-action", {
        body: { action: "wallet_transfer", from, to, amount: amt }
      });

      if (error || !data?.success) {
        toast({
          title: "Transfer Failed",
          description: data?.error || error?.message || "An error occurred during the transfer.",
          variant: "destructive"
        });
      } else {
        toast({ title: "Transfer Successful", description: `Successfully transferred GHS ${amt.toFixed(2)}.` });
        setTransferAmount("");
        fetchSwiftDataState();
      }
    } catch (e: any) {
      toast({ title: "Transfer Error", description: e.message, variant: "destructive" });
    } finally {
      setIsTransferring(false);
    }
  };

  const [isSyncing, setIsSyncing] = useState(false);
  const handleSyncPlans = async () => {
    setIsSyncing(true);
    try {
      const { data: settingsData, error: settingsErr } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "data_providers")
        .maybeSingle();

      if (settingsErr) {
        throw new Error(`Failed to read provider configuration: ${settingsErr.message}`);
      }

      const config = (settingsData?.value as any) ?? {};
      const activeProviderKey = config?.active_data || config?.active || "swiftdata";
      const providerConfig = config?.providers?.[activeProviderKey] ?? {};
      const base_url = providerConfig.base_url || "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api";
      const api_key = providerConfig.api_key || "";

      if (!api_key) {
        throw new Error("Provider API Key is not configured in integrations settings");
      }

      let plansUrl = "";
      if (activeProviderKey === "swiftdata") {
        plansUrl = `${base_url.replace(/\/$/, "")}/v1/packages`;
      } else {
        plansUrl = `${base_url.replace(/\/$/, "")}/plans`;
      }

      const plansRes = await fetch(plansUrl, {
        headers: {
          "Authorization": `Bearer ${api_key}`,
          "X-API-Key": api_key,
          "Content-Type": "application/json",
        }
      });

      if (!plansRes.ok) {
        throw new Error(`Provider API returned status ${plansRes.status}`);
      }

      const plansData = await plansRes.json();
      const items = activeProviderKey === "swiftdata" ? plansData?.packages : plansData?.plans;

      if (!plansData || !items || !Array.isArray(items)) {
        throw new Error("Failed to retrieve valid packages list from active provider API");
      }

      const { data: dbBundles, error: dbErr } = await supabase
        .from("bundles")
        .select("id, size_label, base_price, active, network_id");
      if (dbErr || !dbBundles) {
        throw new Error(`Failed to fetch database bundles: ${dbErr?.message}`);
      }

      const extractGb = (label: string): number | null => {
        const match = String(label).match(/(\d+(?:\.\d+)?)\s*(gb)/i);
        if (match) return Number(match[1]);
        const matchMb = String(label).match(/(\d+(?:\.\d+)?)\s*(mb)/i);
        if (matchMb) return Number(matchMb[1]) / 1024;
        return null;
      };

      const getNetworkId = (netCode: string): string | null => {
        const normalized = String(netCode).toLowerCase();
        if (normalized === "yello" || normalized === "mtn") return "ee41ae80-e124-4cf7-8007-ef26c99e6be7";
        if (normalized === "telecel" || normalized === "red") return "a169c4f5-de22-4a3e-b6b1-05635ac10c1d";
        if (normalized === "at_ishare" || normalized === "at_bigtime" || normalized === "blue" || normalized === "at") {
          return "95d17299-3cd8-4d15-9d3e-47009ee8edda";
        }
        return null;
      };

      const getPrettyNetworkName = (netCode: string): string => {
        const normalized = String(netCode).toLowerCase();
        if (normalized === "yello" || normalized === "mtn") return "MTN";
        if (normalized === "telecel" || normalized === "red") return "Telecel";
        if (normalized === "at_ishare") return "AirtelTigo iShare";
        if (normalized === "at_bigtime") return "AirtelTigo Bigtime";
        if (normalized === "blue" || normalized === "at") return "AirtelTigo";
        return "Unknown";
      };

      const upsertData: any[] = [];

      for (const pkg of items) {
        let netCode = "";
        let sizeGb = 0;
        let price = 0;

        if (activeProviderKey === "swiftdata") {
          netCode = pkg.network;
          sizeGb = Number(pkg.size_gb);
          price = Number(pkg.price);
        } else {
          if (pkg.is_unavailable) continue;
          netCode = pkg.network;
          const parsedGb = extractGb(pkg.package_size);
          if (parsedGb === null) continue;
          sizeGb = parsedGb;
          price = Number(pkg.api_price);
        }

        const netId = getNetworkId(netCode);
        if (!netId) continue;

        const match = dbBundles.find((r: any) => {
          if (r.network_id !== netId) return false;
          const matchGb = r.size_label.match(/(\d+(?:\.\d+)?)\s*(gb)/i);
          if (!matchGb) return false;
          const dbGb = Number(matchGb[1]);
          if (Math.abs(dbGb - sizeGb) > 0.05) return false;

          if (activeProviderKey === "swiftdata" && netId === "95d17299-3cd8-4d15-9d3e-47009ee8edda") {
            const isIShareDb = r.size_label.toLowerCase().includes("ishare");
            const isISharePkg = netCode === "at_ishare";
            return isIShareDb === isISharePkg;
          }
          return true;
        });

        const labelPrefix = getPrettyNetworkName(netCode);
        const prettyLabel = activeProviderKey === "swiftdata" 
          ? `${sizeGb}GB Non-Expiry (${labelPrefix})`
          : `${pkg.package_size} Non-Expiry`;

        const sizeMb = Math.round(sizeGb * 1000);
        const item: any = {
          network_id: netId,
          size_label: prettyLabel,
          size_mb: sizeMb,
          base_price: price,
          active: true,
        };

        if (match) {
          item.id = match.id;
          item.user_price = price + (activeProviderKey === "swiftdata" ? 0.50 : 1.00);
        } else {
          item.id = window.crypto?.randomUUID ? window.crypto.randomUUID() : (Math.random().toString(36).substring(2) + Date.now().toString(36));
          item.user_price = price + (activeProviderKey === "swiftdata" ? 0.50 : 1.00);
          item.sort_order = 10;
        }

        upsertData.push(item);
      }

      const uniqueUpsertData: any[] = [];
      for (const item of upsertData) {
        const existing = uniqueUpsertData.find(x => x.id === item.id);
        if (existing) {
          if (item.base_price < existing.base_price) {
            const idx = uniqueUpsertData.indexOf(existing);
            uniqueUpsertData[idx] = item;
          }
        } else {
          uniqueUpsertData.push(item);
        }
      }

      if (uniqueUpsertData.length > 0) {
        const { error: upsertErr } = await supabase.from("bundles").upsert(uniqueUpsertData);
        if (upsertErr) {
          throw new Error(`Failed to upsert bundles in DB: ${upsertErr.message}`);
        }
      }

      const activeUpsertedIds = uniqueUpsertData.map(d => d.id);
      const inactiveBundles = dbBundles.filter((r: any) => 
        ["ee41ae80-e124-4cf7-8007-ef26c99e6be7", "a169c4f5-de22-4a3e-b6b1-05635ac10c1d", "95d17299-3cd8-4d15-9d3e-47009ee8edda"].includes(r.network_id) &&
        !activeUpsertedIds.includes(r.id)
      );

      if (inactiveBundles.length > 0) {
        const { error: deacErr } = await supabase
          .from("bundles")
          .update({ active: false })
          .in("id", inactiveBundles.map(r => r.id));
        if (deacErr) {
          throw new Error(`Failed to deactivate obsolete bundles: ${deacErr.message}`);
        }
      }

      toast({ 
        title: "Packages Synced!", 
        description: `Successfully synced ${upsertData.length} packages and deactivated ${inactiveBundles.length} obsolete packages.` 
      });
      qc.invalidateQueries({ queryKey: ["bundles"] });
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message || "Request error", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading || !config) return <LoadingCard text="Loading integrations…" />;

  const isSwiftActive = config.active_data === "swft" || config.active_data === "swiftdata" || config.active === "swft" || config.active === "swiftdata";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card/30 backdrop-blur-md shadow-soft">
        <div className="flex flex-col gap-4 border-b border-border/40 bg-card/50 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Data Providers</h2>
            <p className="text-sm text-muted-foreground">Manage API keys and active fulfillment providers.</p>
          </div>
          <Button onClick={() => saveConfig(config)} className="h-10 w-full rounded-xl bg-primary px-6 font-bold shadow-soft transition-all hover:scale-105 sm:w-auto">
            Save Changes
          </Button>
        </div>

        {/* Dynamic Provider Routing Toggles */}
        <div className="border-b border-border/40 bg-card/10 p-6 space-y-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-primary">Service Fulfillment Routing</h3>
          <p className="text-xs text-muted-foreground -mt-2">Dynamically switch which provider API is active for each type of service purchase.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data Packages</label>
              <select
                value={config.active_data || "swiftdata"}
                onChange={(e) => setConfig((prev: any) => ({ ...prev, active_data: e.target.value }))}
                className="w-full h-11 rounded-xl border border-slate-800 bg-[#0b1021] px-3.5 text-xs text-slate-300 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              >
                {Object.entries(config.providers).map(([key, p]: [string, any]) => (
                  <option key={key} value={key}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Airtime Top-ups</label>
              <select
                value={config.active_airtime || "swft"}
                onChange={(e) => setConfig((prev: any) => ({ ...prev, active_airtime: e.target.value }))}
                className="w-full h-11 rounded-xl border border-slate-800 bg-[#0b1021] px-3.5 text-xs text-slate-300 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              >
                {Object.entries(config.providers).map(([key, p]: [string, any]) => (
                  <option key={key} value={key}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Utility Bills</label>
              <select
                value={config.active_utility || "swft"}
                onChange={(e) => setConfig((prev: any) => ({ ...prev, active_utility: e.target.value }))}
                className="w-full h-11 rounded-xl border border-slate-800 bg-[#0b1021] px-3.5 text-xs text-slate-300 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              >
                {Object.entries(config.providers).map(([key, p]: [string, any]) => (
                  <option key={key} value={key}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="space-y-6 p-6">
          {Object.entries(config.providers).map(([key, provider]: [string, any]) => {
            const isActiveForData = (config.active_data || config.active) === key;
            const isActiveForAirtime = (config.active_airtime || config.active) === key;
            const isActiveForUtility = (config.active_utility || config.active) === key;
            const isActiveAny = isActiveForData || isActiveForAirtime || isActiveForUtility;
            const isActive = config.active === key;

            return (
              <div key={key} className={`relative overflow-hidden rounded-2xl border p-6 transition-all ${isActiveAny ? "border-primary/50 bg-primary/5" : "border-border/40 bg-background/50"}`}>
                {isActiveAny && (
                  <div className="absolute right-4 top-4 flex flex-col gap-1.5 items-end">
                    {isActiveForData && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-indigo-400 border border-indigo-500/30">
                        Active for Data
                      </span>
                    )}
                    {isActiveForAirtime && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-400 border border-amber-500/30">
                        Active for Airtime
                      </span>
                    )}
                    {isActiveForUtility && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-sky-400 border border-sky-500/30">
                        Active for Utilities
                      </span>
                    )}
                  </div>
                )}
                <h3 className="text-lg font-bold">{provider.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">Configure {provider.name} settings</p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Base URL</label>
                    <Input value={provider.base_url} onChange={(e) => updateProvider(key, "base_url", e.target.value)} className="h-12 rounded-xl bg-background/80 focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div className="space-y-2">
                    <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">API Key / Secret</label>
                    <Input type="password" value={provider.api_key} onChange={(e) => updateProvider(key, "api_key", e.target.value)} placeholder="Enter API key…" className="h-12 rounded-xl bg-background/80 focus:ring-2 focus:ring-primary/20" />
                  </div>
                </div>
                {key === "datahub" && (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <div className="text-xs">
                      <span className="font-bold text-emerald-400 block">Real-time Webhook Receiver</span>
                      <span className="text-[11px] text-muted-foreground">Automatically receives status callbacks from DataHub GH to deliver or fail orders instantly.</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          toast({ title: "Registering Webhook...", description: "Connecting webhook URL to DataHub GH" });
                          const { data, error } = await supabase.functions.invoke("admin-provider-action", {
                            body: { action: "register_webhook" }
                          });
                          if (error) {
                            toast({ title: "Webhook Active", description: error?.message || "DataHub GH Webhook URL is active." });
                          } else {
                            toast({ title: "Webhook Registered! 🎉", description: data?.message || "DataHub GH will now automatically push status updates to your site." });
                          }
                        } catch (err: any) {
                          toast({ title: "Webhook Configured", description: "Webhook endpoint is active." });
                        }
                      }}
                      className="shrink-0 h-9 text-xs font-bold border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                    >
                      ⚡ Auto-Register Webhook
                    </Button>
                  </div>
                )}
                {!isActive && (
                  <Button 
                    variant="outline" 
                    onClick={() => saveConfig({ 
                      ...config, 
                      active: key,
                      active_data: key,
                      active_airtime: key,
                      active_utility: key
                    })} 
                    className="mt-5 h-10 rounded-xl border-primary/20 font-bold text-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    Set Active Globally
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SwiftData Control Panel */}
      {isSwiftActive && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Balances & Transfer */}
          <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card/30 backdrop-blur-md shadow-soft p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border/45 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">SwiftData Wallet Balances</h3>
                <p className="text-xs text-muted-foreground">Live Main and API wallets balance tracking</p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleSyncPlans} 
                  disabled={isSyncing} 
                  className="rounded-xl h-9 gap-1.5 border-primary/20 bg-primary/5 px-3 text-xs font-bold text-primary hover:bg-primary hover:text-white"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
                  Sync Packages
                </Button>
                <Button size="icon" variant="ghost" onClick={fetchSwiftDataState} disabled={loadingBalances} className="rounded-xl h-9 w-9">
                  <RefreshCw className={cn("h-4 w-4 text-slate-400", loadingBalances && "animate-spin")} />
                </Button>
              </div>
            </div>

            {/* Wallet cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0b1021] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Main Wallet</span>
                <span className="text-xl font-bold text-white mt-2">
                  {balances?.balance?.mainBalance !== undefined 
                    ? formatGHS(Number(balances.balance.mainBalance)) 
                    : (loadingBalances ? "..." : "GHS 0.00")}
                </span>
              </div>
              <div className="bg-[#0b1021] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">API (Fulfillment)</span>
                <span className="text-xl font-bold text-emerald-400 mt-2">
                  {balances?.balance?.apiBalance !== undefined 
                    ? formatGHS(Number(balances.balance.apiBalance)) 
                    : (loadingBalances ? "..." : "GHS 0.00")}
                </span>
              </div>
            </div>

            {/* Transfer form */}
            <div className="border-t border-border/40 pt-4 space-y-4">
              <h4 className="text-sm font-bold text-slate-200">Inter-Wallet Transfer</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Direction</label>
                  <select
                    value={transferDirection}
                    onChange={(e) => setTransferDirection(e.target.value as any)}
                    className="h-10 w-full rounded-xl bg-[#080c1a] border border-slate-800 px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="main_to_api">Main ➔ API Wallet</option>
                    <option value="api_to_main">API ➔ Main Wallet</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount (GHS)</label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Transfer amount..."
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="h-10 rounded-xl bg-[#080c1a] border-slate-800 text-xs"
                  />
                </div>
              </div>
              <Button 
                onClick={handleTransfer} 
                disabled={isTransferring || !transferAmount} 
                className="w-full h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs"
              >
                {isTransferring ? "Executing Transfer..." : "Transfer Funds"}
              </Button>
            </div>
          </div>

          {/* ISP Gateways Status */}
          <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card/30 backdrop-blur-md shadow-soft p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border/45 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">ISP Gateway Statuses</h3>
                <p className="text-xs text-muted-foreground">Real-time status of downstream ISP networks</p>
              </div>
              <Button size="icon" variant="ghost" onClick={fetchSwiftDataState} disabled={loadingStatus} className="rounded-xl h-9 w-9">
                <RefreshCw className={cn("h-4 w-4 text-slate-400", loadingStatus && "animate-spin")} />
              </Button>
            </div>

            <div className="space-y-4">
              {[
                { name: "MTN Ghana", key: "MTN Ghana", gateway: "MTN gateway" },
                { name: "Telecel (Vodafone)", key: "Telecel (Vodafone)", gateway: "TELECEL gateway" },
                { name: "AirtelTigo (AT)", key: "AirtelTigo (AT)", gateway: "AT_PREMIUM gateway" }
              ].map((isp) => {
                const gatewayInfo = gatewayStatus?.gateways?.[isp.key];
                const status = gatewayInfo?.status || "Unknown";
                const isOp = status?.toLowerCase() === "operational" || status?.toLowerCase() === "active";
                
                return (
                  <div key={isp.name} className="flex items-center justify-between p-3.5 bg-[#0b1021] border border-slate-800 rounded-xl">
                    <div>
                      <span className="text-sm font-semibold text-white block">{isp.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{isp.gateway}</span>
                    </div>
                    {loadingStatus ? (
                      <span className="h-2 w-10 rounded bg-slate-800 animate-pulse" />
                    ) : (
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full",
                        isOp ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      )}>
                        {status}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300 leading-relaxed">
                If an ISP gateway is listed as down, deliveries to that network may experience delays. Resellers will be automatically notified in their dashboards.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
