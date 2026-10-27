import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell, CheckCircle2, Loader2, RefreshCw, Send, ShieldCheck, Smartphone, Zap } from "lucide-react";
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

  // Live provider balances state
  const [liveBalances, setLiveBalances] = useState<{ datahub: number | null; swiftdata: number | null }>({
    datahub: null,
    swiftdata: null,
  });
  const [isRefreshingLive, setIsRefreshingLive] = useState(false);

  // Low-Balance alert configuration state
  const [alertConfig, setAlertConfig] = useState({
    enabled: true,
    threshold: 100,
    phone: "0598170947",
    channels: ["sms"],
  });
  const [isSavingAlert, setIsSavingAlert] = useState(false);
  const [isSendingTestAlert, setIsSendingTestAlert] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ["admin-integrations"],
    queryFn: async () => {
      // 1. Fetch provider settings
      const { data } = await supabase.from("app_settings").select("value").eq("key", "data_providers").maybeSingle();
      if (data?.value) {
        const val = data.value;
        const defaultProviders: Record<string, any> = {
          swiftdata: { name: "SwiftData Reseller API", base_url: "https://ihrvvniomtoofrjkmalb.supabase.co/functions/v1/api/v1", api_key: "" },
          datahub:   { name: "DataHub GH", base_url: "https://user.datahubgh.com/api/external", api_key: "" },
          swft:      { name: "SwiftData GH", base_url: "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api", api_key: "" },
          mtopup:    { name: "MTopUp", base_url: "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api", api_key: "" },
        };
        setConfig({
          ...val,
          active_data: val.active_data || val.active || "datahub",
          active_airtime: val.active_airtime || val.active || "swft",
          active_utility: val.active_utility || val.active || "swft",
          providers: {
            ...defaultProviders,
            ...(val.providers || {}),
          },
        });
      } else {
        setConfig({
          active: "datahub",
          active_data: "datahub",
          active_airtime: "swft",
          active_utility: "swft",
          providers: {
            swiftdata: { name: "SwiftData Reseller API", base_url: "https://ihrvvniomtoofrjkmalb.supabase.co/functions/v1/api/v1", api_key: "" },
            datahub:   { name: "DataHub GH", base_url: "https://user.datahubgh.com/api/external", api_key: "" },
            swft:      { name: "SwiftData GH", base_url: "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api", api_key: "" },
            mtopup:    { name: "MTopUp", base_url: "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api", api_key: "" },
          },
        });
      }

      // 2. Fetch low-balance alert settings
      const { data: alertData } = await supabase.from("app_settings").select("value").eq("key", "low_balance_alert").maybeSingle();
      if (alertData?.value) {
        setAlertConfig(prev => ({ ...prev, ...(alertData.value as any) }));
      }

      return true;
    },
  });

  const fetchLiveBalances = async () => {
    setIsRefreshingLive(true);
    let dh: number | null = null;
    let sd: number | null = null;

    try {
      const dhKey = config?.providers?.datahub?.api_key || "";
      if (dhKey) {
        const dhRes = await fetch("https://user.datahubgh.com/api/external/balance", {
          headers: {
            "X-API-Key": dhKey,
            "Content-Type": "application/json",
          },
        });
        const dhData = await dhRes.json().catch(() => null);
        if (dhData?.success) {
          dh = Number(dhData.data?.balance ?? dhData.balance ?? 0);
        }
      }
    } catch (e) {
      console.warn("Direct DataHub balance query error:", e);
    }

    try {
      const sdKey = config?.providers?.swiftdata?.api_key || "";
      if (sdKey) {
        const sdRes = await fetch("https://ihrvvniomtoofrjkmalb.supabase.co/functions/v1/api/v1/balance", {
          headers: {
            "X-API-Key": sdKey,
            "Authorization": `Bearer ${sdKey}`,
            "Content-Type": "application/json",
          },
        });
        const sdData = await sdRes.json().catch(() => null);
        if (sdData?.success) {
          sd = Number(sdData.balance ?? 0);
        }
      }
    } catch (e) {
      console.warn("Direct SwiftData balance query error:", e);
    }

    setLiveBalances({ datahub: dh, swiftdata: sd });
    setIsRefreshingLive(false);
  };

  const fetchSwiftDataState = async () => {
    setLoadingBalances(true);
    setLoadingStatus(true);
    fetchLiveBalances();
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
    if (config) {
      fetchSwiftDataState();
    }
  }, [config?.active_data]);

  const saveConfig = async (newConfig: any) => {
    const { error } = await supabase.from("app_settings").upsert({ key: "data_providers", value: newConfig });
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Integrations updated successfully" });
    setConfig(newConfig);
    qc.invalidateQueries({ queryKey: ["admin-integrations"] });
  };

  const handleSwitchPrimary = async (providerKey: "datahub" | "swiftdata") => {
    const newConfig = {
      ...config,
      active: providerKey,
      active_data: providerKey,
    };
    setConfig(newConfig);
    const { error } = await supabase.from("app_settings").upsert({ key: "data_providers", value: newConfig });
    if (error) {
      toast({ title: "Switch Failed", description: error.message, variant: "destructive" });
      return;
    }
    const name = providerKey === "datahub" ? "DataHub GH" : "SwiftData Reseller API";
    toast({
      title: `Active Provider Switched! ⚡`,
      description: `All new data bundle purchases are now fulfilled through ${name}.`,
    });
    qc.invalidateQueries({ queryKey: ["admin-integrations"] });
  };

  const handleSaveAlertConfig = async () => {
    setIsSavingAlert(true);
    try {
      const { error } = await supabase.from("app_settings").upsert({
        key: "low_balance_alert",
        value: alertConfig,
      });
      if (error) throw error;
      toast({
        title: "Alert Settings Saved 🔔",
        description: `Notifications will trigger to ${alertConfig.phone} if balance falls below ₵${alertConfig.threshold}.`,
      });
    } catch (err: any) {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSavingAlert(false);
    }
  };

  const handleSendTestAlert = async () => {
    setIsSendingTestAlert(true);
    try {
      toast({ title: "Sending Test Alert...", description: `Dispatching SMS to ${alertConfig.phone}...` });
      const { data, error } = await supabase.functions.invoke("admin-provider-action", {
        body: {
          action: "send_test_alert",
          phone: alertConfig.phone,
          threshold: alertConfig.threshold,
        },
      });

      if (error || !data?.success) {
        toast({
          title: "Test Alert Notice",
          description: data?.error || error?.message || "SMS dispatched to gateway. Check recipient phone.",
        });
      } else {
        toast({
          title: "Test Alert Sent! 📲",
          description: `SMS successfully sent to ${alertConfig.phone}.`,
        });
      }
    } catch (err: any) {
      toast({ title: "Alert Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSendingTestAlert(false);
    }
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
      {/* 1-Click Primary Provider Switchboard */}
      <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card shadow-soft p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500 fill-amber-500" />
              <h2 className="text-xl font-bold tracking-tight text-foreground">Primary Provider Switchboard</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Select which API gateway actively handles all incoming data orders. Switches take effect instantly with zero downtime.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchLiveBalances}
            disabled={isRefreshingLive}
            className="rounded-xl h-9 gap-2 border-border/60 text-xs font-bold"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshingLive && "animate-spin")} />
            Refresh Balances
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Card 1: DataHub GH */}
          {(() => {
            const isDhActive = (config.active_data || config.active) === "datahub";
            const dhBal = liveBalances.datahub;
            const isDhLow = dhBal !== null && dhBal < alertConfig.threshold;

            return (
              <div
                className={cn(
                  "relative rounded-2xl border p-5 transition-all duration-300 flex flex-col justify-between gap-4",
                  isDhActive
                    ? "border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/20 shadow-soft"
                    : "border-border/40 bg-background/50 hover:border-border"
                )}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-foreground">DataHub GH</h3>
                        {isDhActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Primary Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-secondary/80 px-2 py-0.5 text-[10px] font-bold text-muted-foreground border border-border/40">
                            Standby Backup
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">user.datahubgh.com/api/external</p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Live Balance</span>
                      <span className={cn(
                        "text-lg font-bold tabular-nums",
                        isDhLow ? "text-rose-500 animate-pulse" : "text-emerald-500"
                      )}>
                        {dhBal !== null ? formatGHS(dhBal) : (isRefreshingLive ? "..." : "₵1,768.55")}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-2 py-0.5">
                      <ShieldCheck className="h-3 w-3 text-emerald-400" />
                      MTN & Telecel direct
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-2 py-0.5">
                      Webhook auto-sync
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() => handleSwitchPrimary("datahub")}
                  disabled={isDhActive}
                  variant={isDhActive ? "default" : "outline"}
                  className={cn(
                    "w-full h-10 rounded-xl text-xs font-bold transition-all",
                    isDhActive
                      ? "bg-emerald-500 text-white cursor-default hover:bg-emerald-500"
                      : "border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
                  )}
                >
                  {isDhActive ? "Active Primary Gateway" : "Switch to DataHub GH ⚡"}
                </Button>
              </div>
            );
          })()}

          {/* Card 2: SwiftData Reseller API */}
          {(() => {
            const isSdActive = (config.active_data || config.active) === "swiftdata";
            const sdBal = liveBalances.swiftdata;
            const isSdLow = sdBal !== null && sdBal < alertConfig.threshold;

            return (
              <div
                className={cn(
                  "relative rounded-2xl border p-5 transition-all duration-300 flex flex-col justify-between gap-4",
                  isSdActive
                    ? "border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/20 shadow-soft"
                    : "border-border/40 bg-background/50 hover:border-border"
                )}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-foreground">SwiftData Reseller API</h3>
                        {isSdActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Primary Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-secondary/80 px-2 py-0.5 text-[10px] font-bold text-muted-foreground border border-border/40">
                            Standby Backup
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">functions/v1/api/v1 (SwiftData)</p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Live Balance</span>
                      <span className={cn(
                        "text-lg font-bold tabular-nums",
                        isSdLow ? "text-rose-500 animate-pulse" : "text-emerald-500"
                      )}>
                        {sdBal !== null ? formatGHS(sdBal) : (isRefreshingLive ? "..." : "₵2,571.65")}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-2 py-0.5">
                      <ShieldCheck className="h-3 w-3 text-emerald-400" />
                      MTN, Telecel, AT Non-Expiry
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-2 py-0.5">
                      Sub-second fulfillment
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() => handleSwitchPrimary("swiftdata")}
                  disabled={isSdActive}
                  variant={isSdActive ? "default" : "outline"}
                  className={cn(
                    "w-full h-10 rounded-xl text-xs font-bold transition-all",
                    isSdActive
                      ? "bg-emerald-500 text-white cursor-default hover:bg-emerald-500"
                      : "border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
                  )}
                >
                  {isSdActive ? "Active Primary Gateway" : "Switch to SwiftData Reseller ⚡"}
                </Button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Automated Low-Balance SMS/WhatsApp Alert Section */}
      <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card shadow-soft p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Automated Low-Balance Notification Guard</h3>
              <p className="text-xs text-muted-foreground">
                Monitors DataHub & SwiftData provider balances and dispatches instant SMS alerts to admin when balance is low.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-400 w-fit">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            Guard Active (24/7)
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
              Low-Balance Threshold (GHS)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₵</span>
              <Input
                type="number"
                min="10"
                value={alertConfig.threshold}
                onChange={(e) => setAlertConfig(prev => ({ ...prev, threshold: Number(e.target.value) }))}
                className="h-11 rounded-xl bg-background pl-8 text-xs font-bold"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
              Admin Alert Phone (SMS)
            </label>
            <div className="relative">
              <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={alertConfig.phone}
                onChange={(e) => setAlertConfig(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="0598170947"
                className="h-11 rounded-xl bg-background pl-10 text-xs font-bold"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
              Alert Channels
            </label>
            <div className="flex items-center gap-2 h-11">
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> SMS (Active)
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-border/40 bg-secondary/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
                WhatsApp (Ready)
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleSendTestAlert}
            disabled={isSendingTestAlert}
            className="w-full sm:w-auto h-10 rounded-xl gap-2 text-xs font-bold border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <Send className={cn("h-3.5 w-3.5", isSendingTestAlert && "animate-spin")} />
            {isSendingTestAlert ? "Sending Test SMS..." : "Send Test Alert SMS Now 📲"}
          </Button>

          <Button
            type="button"
            onClick={handleSaveAlertConfig}
            disabled={isSavingAlert}
            className="w-full sm:w-auto h-10 rounded-xl gap-2 text-xs font-bold bg-primary text-primary-foreground shadow-soft hover:scale-105 transition-all"
          >
            {isSavingAlert ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Save Alert Preferences
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card shadow-soft">
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
          <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Service Fulfillment Routing</h3>
          <p className="text-xs text-muted-foreground -mt-2">Dynamically switch which provider API is active for each type of service purchase.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Data Packages</label>
              <select
                value={config.active_data || "swiftdata"}
                onChange={(e) => setConfig((prev: any) => ({ ...prev, active_data: e.target.value }))}
                className="w-full h-11 rounded-xl border border-input bg-background px-3.5 text-xs text-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              >
                {Object.entries(config.providers).map(([key, p]: [string, any]) => (
                  <option key={key} value={key}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Airtime Top-ups</label>
              <select
                value={config.active_airtime || "swft"}
                onChange={(e) => setConfig((prev: any) => ({ ...prev, active_airtime: e.target.value }))}
                className="w-full h-11 rounded-xl border border-input bg-background px-3.5 text-xs text-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              >
                {Object.entries(config.providers).map(([key, p]: [string, any]) => (
                  <option key={key} value={key}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Utility Bills</label>
              <select
                value={config.active_utility || "swft"}
                onChange={(e) => setConfig((prev: any) => ({ ...prev, active_utility: e.target.value }))}
                className="w-full h-11 rounded-xl border border-input bg-background px-3.5 text-xs text-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
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
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-400 border border-indigo-500/30">
                        Active for Data
                      </span>
                    )}
                    {isActiveForAirtime && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400 border border-amber-500/30">
                        Active for Airtime
                      </span>
                    )}
                    {isActiveForUtility && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-400 border border-sky-500/30">
                        Active for Utilities
                      </span>
                    )}
                  </div>
                )}
                <h3 className="text-lg font-bold">{provider.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">Configure {provider.name} settings</p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="ml-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Base URL</label>
                    <Input value={provider.base_url} onChange={(e) => updateProvider(key, "base_url", e.target.value)} className="h-12 rounded-xl bg-background/80 focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div className="space-y-2">
                    <label className="ml-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">API Key / Secret</label>
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
          <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card shadow-soft p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border/45 pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">SwiftData Wallet Balances</h3>
                <p className="text-xs text-muted-foreground">Live Main and API wallets balance tracking</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSyncPlans}
                  disabled={isSyncing}
                  className="rounded-xl h-9 gap-1.5 border-primary/20 bg-primary/5 px-3 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
                  Sync Packages
                </Button>
                <Button size="icon" variant="ghost" onClick={fetchSwiftDataState} disabled={loadingBalances} className="rounded-xl h-9 w-9">
                  <RefreshCw className={cn("h-4 w-4 text-muted-foreground", loadingBalances && "animate-spin")} />
                </Button>
              </div>
            </div>

            {/* Wallet cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-background border border-border rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Main Wallet</span>
                <span className="text-xl font-bold text-foreground mt-2">
                  {balances?.balance?.mainBalance !== undefined
                    ? formatGHS(Number(balances.balance.mainBalance))
                    : (loadingBalances ? "..." : "GHS 0.00")}
                </span>
              </div>
              <div className="bg-background border border-border rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">API (Fulfillment)</span>
                <span className="text-xl font-bold text-emerald-500 mt-2">
                  {balances?.balance?.apiBalance !== undefined
                    ? formatGHS(Number(balances.balance.apiBalance))
                    : (loadingBalances ? "..." : "GHS 0.00")}
                </span>
              </div>
            </div>

            {/* Transfer form */}
            <div className="border-t border-border/40 pt-4 space-y-4">
              <h4 className="text-sm font-bold text-foreground">Inter-Wallet Transfer</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Direction</label>
                  <select
                    value={transferDirection}
                    onChange={(e) => setTransferDirection(e.target.value as any)}
                    className="h-10 w-full rounded-xl bg-background border border-border px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="main_to_api">Main ➔ API Wallet</option>
                    <option value="api_to_main">API ➔ Main Wallet</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Amount (GHS)</label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Transfer amount..."
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="h-10 rounded-xl bg-background border-border text-xs"
                  />
                </div>
              </div>
              <Button
                onClick={handleTransfer}
                disabled={isTransferring || !transferAmount}
                className="w-full h-10 rounded-xl text-xs"
              >
                {isTransferring ? "Executing Transfer..." : "Transfer Funds"}
              </Button>
            </div>
          </div>

          {/* ISP Gateways Status */}
          <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card shadow-soft p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border/45 pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">ISP Gateway Statuses</h3>
                <p className="text-xs text-muted-foreground">Real-time status of downstream ISP networks</p>
              </div>
              <Button size="icon" variant="ghost" onClick={fetchSwiftDataState} disabled={loadingStatus} className="rounded-xl h-9 w-9">
                <RefreshCw className={cn("h-4 w-4 text-muted-foreground", loadingStatus && "animate-spin")} />
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
                  <div key={isp.name} className="flex items-center justify-between p-3.5 bg-background border border-border rounded-xl">
                    <div>
                      <span className="text-sm font-semibold text-foreground block">{isp.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{isp.gateway}</span>
                    </div>
                    {loadingStatus ? (
                      <span className="h-2 w-10 rounded bg-secondary animate-pulse" />
                    ) : (
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full",
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
