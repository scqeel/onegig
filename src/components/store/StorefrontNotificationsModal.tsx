import { useState, useEffect } from "react";
import { Bell, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export function StorefrontNotificationsModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('og_store_dismissed_notifications');
      if (stored) setDismissedIds(JSON.parse(stored));
    } catch (e) {
      console.warn("Failed to load store dismissed notifications", e);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open]);

  const fetchNotifications = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('app_notifications')
      .select('*')
      .eq('is_global', true)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (!error && data) {
      setNotifications(data);
    }
    setLoading(false);
  };

  const handleDismiss = (id: string) => {
    const newDismissed = [...dismissedIds, id];
    setDismissedIds(newDismissed);
    localStorage.setItem('og_store_dismissed_notifications', JSON.stringify(newDismissed));
  };

  const activeNotifications = notifications.filter(n => !dismissedIds.includes(n.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border border-border rounded-[1.75rem] p-6">
        <DialogTitle className="sr-only">Notice</DialogTitle>
        <DialogDescription className="sr-only">Authentication or Verification Notice</DialogDescription>
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" /> Notifications
          </DialogTitle>
          <DialogDescription className="text-xs font-medium text-muted-foreground">
            Latest announcements and updates.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto pr-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : activeNotifications.length === 0 ? (
            <div className="text-center py-10 bg-secondary/40 rounded-2xl border border-dashed border-border">
              <p className="text-sm font-semibold text-muted-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-1">No new notifications.</p>
            </div>
          ) : (
            activeNotifications.map(n => (
              <div key={n.id} className="relative p-4 rounded-2xl bg-primary/5 border border-primary/15 group transition-all">
                <button
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handleDismiss(n.id);
                  }}
                  className="absolute top-3 right-3 text-primary/50 hover:text-primary transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
                <h4 className="text-sm font-semibold text-foreground pr-6">{n.title}</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{n.message}</p>
                <div className="mt-2 text-[9px] font-semibold uppercase text-primary/70">
                  {new Date(n.created_at).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
