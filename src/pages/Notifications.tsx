import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Bell, ArrowLeft, Loader2, CheckCircle, Info, AlertTriangle, ShieldCheck, Trash2 } from "lucide-react";
import { timeAgo } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function NotificationsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const [selectedNotification, setSelectedNotification] = useState<any>(null);

  const { data: hiddenIds = [] } = useQuery({
    queryKey: ["hidden-notifications", session?.user.id],
    enabled: !!session?.user.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_hidden_notifications")
        .select("notification_id")
        .eq("user_id", session!.user.id);
      return data?.map(d => d.notification_id) ?? [];
    }
  });

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", session?.user.id],
    enabled: !!session?.user.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data ?? [];
    }
  });

  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!session?.user.id) return;
      const { error } = await supabase
        .from("profiles")
        .update({ last_notification_check: new Date().toISOString() })
        .eq("id", session.user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unread-notifications-count"] });
    }
  });

  useEffect(() => {
    if (session?.user.id) {
      markAsReadMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  const deleteMutation = useMutation({
    mutationFn: async (n: any) => {
      if (n.is_global) {
        const { error } = await supabase
          .from("user_hidden_notifications")
          .insert({ user_id: session!.user.id, notification_id: n.id });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("app_notifications")
          .delete()
          .eq("id", n.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["hidden-notifications"] });
      setSelectedNotification(null);
    }
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "success": return <CheckCircle className="h-5 w-5 text-emerald-500" />;
      case "warning": return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case "error":   return <AlertTriangle className="h-5 w-5 text-rose-500" />;
      case "admin":   return <ShieldCheck className="h-5 w-5 text-primary" />;
      default:        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getBg = (type: string) => {
    switch (type) {
      case "success": return "bg-emerald-500/10 text-emerald-500";
      case "warning": return "bg-amber-500/10 text-amber-500";
      case "error":   return "bg-rose-500/10 text-rose-500";
      case "admin":   return "bg-primary/10 text-primary";
      default:        return "bg-blue-500/10 text-blue-500";
    }
  };

  const visibleNotifications = notifications?.filter(n => !hiddenIds.includes(n.id)) ?? [];

  return (
    <DashboardLayout
      title="Notifications"
      subtitle="Your recent alerts and updates."
      badge="Alerts"
    >
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
        <div className="mb-4">
          <Link to="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Link>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card shadow-soft">
          <div className="border-b border-border/40 bg-card/50 p-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">All Notifications</h2>
              <p className="text-sm text-muted-foreground">Stay updated with the latest activity.</p>
            </div>
          </div>
          
          <div className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-12 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading...
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                  <Bell className="h-8 w-8 opacity-20" />
                </div>
                <h3 className="text-lg font-bold">You're all caught up!</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                  You have no new notifications at the moment. We'll alert you when something happens.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {visibleNotifications.map((n: any) => (
                  <button 
                    key={n.id} 
                    type="button"
                    onClick={() => setSelectedNotification(n)}
                    className="flex w-full text-left gap-4 p-5 hover:bg-secondary/40 transition-colors group"
                  >
                    <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${getBg(n.type)}`}>
                      {getIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-foreground truncate">{n.title}</h3>
                        <span className="shrink-0 text-[10px] uppercase font-bold tracking-wider text-muted-foreground ml-auto">{timeAgo(n.created_at)}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground truncate">{n.message}</p>
                    </div>
                    <div className="flex items-center justify-center shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(n);
                        }}
                      >
                        {deleteMutation.isPending && deleteMutation.variables?.id === n.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!selectedNotification} onOpenChange={(open) => !open && setSelectedNotification(null)}>
        <DialogContent className="sm:max-w-md rounded-[2rem]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              {selectedNotification && (
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${getBg(selectedNotification.type)}`}>
                  {getIcon(selectedNotification.type)}
                </div>
              )}
              <DialogTitle className="text-xl">{selectedNotification?.title}</DialogTitle>
            </div>
            {selectedNotification && (
               <p className="text-xs font-medium text-muted-foreground pb-2 border-b border-border/40">
                 {new Date(selectedNotification.created_at).toLocaleString()}
               </p>
            )}
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {selectedNotification?.message}
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border/40">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setSelectedNotification(null)}
            >
              Close
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              disabled={deleteMutation.isPending}
              onClick={() => selectedNotification && deleteMutation.mutate(selectedNotification)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
