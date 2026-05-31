import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUnreadNotifications() {
  const { session } = useAuth();
  
  return useQuery({
    queryKey: ["unread-notifications-count", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("last_notification_check")
        .eq("id", session!.user.id)
        .single();
        
      const lastCheck = profile?.last_notification_check || new Date(0).toISOString();

      const { count } = await supabase
        .from("app_notifications")
        .select("*", { count: "exact", head: true })
        .gt("created_at", lastCheck)
        .or(`is_global.eq.true,target_user_id.eq.${session!.user.id}`);
        
      return count || 0;
    },
    refetchInterval: 30000,
  });
}
