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
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-none rounded-[32px] p-6 shadow-2xl">
        <DialogTitle className="sr-only">Notice</DialogTitle>
        <DialogDescription className="sr-only">Authentication or Verification Notice</DialogDescription>
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Bell className="h-5 w-5 text-indigo-500" /> Notifications
          </DialogTitle>
          <DialogDescription className="text-xs font-medium text-slate-500">
            Latest announcements and updates.
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto pr-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
          ) : activeNotifications.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              <p className="text-sm font-bold text-slate-400">All caught up!</p>
              <p className="text-xs text-slate-500 mt-1">No new notifications.</p>
            </div>
          ) : (
            activeNotifications.map(n => (
              <div key={n.id} className="relative p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 group transition-all">
                <button 
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handleDismiss(n.id);
                  }}
                  className="absolute top-3 right-3 text-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 pr-6">{n.title}</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{n.message}</p>
                <div className="mt-2 text-[9px] font-black uppercase text-indigo-400/80">
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
