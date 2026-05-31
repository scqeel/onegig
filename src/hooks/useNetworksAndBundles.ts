import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NetworkRow {
  id: string;
  name: string;
  code: string;
  color: string;
  logo_emoji: string;
}
export interface BundleRow {
  id: string;
  network_id: string;
  size_label: string;
  size_mb: number;
  base_price: number;
  user_price?: number;
}

export function useNetworks() {
  return useQuery({
    queryKey: ["networks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("networks").select("id, name, code, color, logo_emoji").eq("active", true).order("sort_order");
      if (error) throw error;
      return data as NetworkRow[];
    },
  });
}

export function useBundles(networkId: string | null) {
  return useQuery({
    queryKey: ["bundles", networkId],
    enabled: !!networkId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bundles")
        .select("id, network_id, size_label, size_mb, user_price")
        .eq("active", true)
        .eq("network_id", networkId)
        .order("size_mb", { ascending: true });
      if (error) throw error;
      return data as BundleRow[];
    },
  });
}

export function useAgentBundles(agentId: string | null) {
  return useQuery({
    queryKey: ["agent-bundles", agentId],
    enabled: !!agentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_bundle_prices")
        .select("bundle_id, sell_price")
        .eq("agent_id", agentId)
        .eq("active", true);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => (map[r.bundle_id] = Number(r.sell_price)));
      return map;
    },
  });
}