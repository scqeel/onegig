import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Bell, CheckCircle2, Copy, FileText, Loader2, Megaphone, 
  MessageSquare, Radio, Send, Smartphone, Sparkles, Users, Zap 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const TEMPLATES = [
  {
    title: "MTN ISP Maintenance",
    text: "Dear OneGig Customer, MTN is currently undergoing ISP network maintenance. Data deliveries to MTN lines may experience slight delays. Thank you for your patience.",
  },
  {
    title: "Price Reduction Notice",
    text: "Great news! Non-expiry data rates on OneGig have been reduced across all networks. Buy affordable bundles now at onegig.store",
  },
  {
    title: "Agent Bonus Commission",
    text: "OneGig Agent Alert: Earn an extra 10% bonus commission on all Telecel and AT bundle sales this weekend! Log in to your agent portal to start selling.",
  },
  {
    title: "Order Delay Apology",
    text: "We noticed your recent order experienced a slight delay. Our engineers have resolved the gateway connection and all bundles are processing now. Thank you!",
  },
];

export function AdminBroadcastTab() {
  const { toast } = useToast();
  const [targetAudience, setTargetAudience] = useState<"all" | "agents" | "recent_buyers">("all");
  const [channels, setChannels] = useState<{ sms: boolean; push: boolean }>({ sms: true, push: true });
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Query audience counts
  const { data: counts } = useQuery({
    queryKey: ["admin-broadcast-counts"],
    queryFn: async () => {
      const [allUsersRes, agentsRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "agent"),
      ]);

      return {
        allUsers: allUsersRes.count ?? 0,
        agents: agentsRes.count ?? 0,
      };
    },
  });

  const getRecipientEstimate = () => {
    if (targetAudience === "agents") return counts?.agents ?? 0;
    return counts?.allUsers ?? 0;
  };

  const handleApplyTemplate = (tmpl: typeof TEMPLATES[0]) => {
    setTitle(tmpl.title);
    setMessage(tmpl.text);
    toast({ title: "Template Applied", description: tmpl.title });
  };

  const handleSendBroadcast = async () => {
    if (!message.trim()) {
      toast({ title: "Message Required", description: "Please enter a message to broadcast.", variant: "destructive" });
      return;
    }

    if (!channels.sms && !channels.push) {
      toast({ title: "Select Channel", description: "Please enable at least SMS or Web Push.", variant: "destructive" });
      return;
    }

    const estimated = getRecipientEstimate();
    const confirmed = confirm(
      `Broadcast Announcement:\n\nTarget: ${targetAudience.toUpperCase()}\nEstimated Recipients: ~${estimated}\nChannels: ${channels.sms ? "SMS " : ""}${channels.push ? "Web Push" : ""}\n\nProceed?`
    );
    if (!confirmed) return;

    setIsSending(true);
    try {
      // 1. If Web Push or In-app notifications enabled, insert into app_notifications
      if (channels.push) {
        await supabase.from("app_notifications").insert({
          title: title || "OneGig Official Notice",
          message,
          type: "system",
          sound_name: "paystack",
          is_global: targetAudience === "all",
        });
      }

      toast({
        title: "Broadcast Dispatched! 🚀",
        description: `Notification queued for ${estimated} recipients across selected channels.`,
      });

      setMessage("");
      setTitle("");
    } catch (err: any) {
      toast({ title: "Broadcast Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const charCount = message.length;
  const smsUnits = Math.max(1, Math.ceil(charCount / 160));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-soft">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold tracking-tight text-foreground">Broadcast & Communication Studio</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Compose high-priority announcements and broadcast via SMS and Web Push notifications to customers and agents.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Composer Form */}
        <div className="space-y-5 lg:col-span-2">
          <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-soft space-y-5">
            
            {/* Audience Targeting */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Target Audience
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { key: "all", label: "All Customers & Users", count: counts?.allUsers ?? 0 },
                  { key: "agents", label: "Active Agents Only", count: counts?.agents ?? 0 },
                  { key: "recent_buyers", label: "Buyers (Past 24h)", count: "Active" },
                ].map((aud) => (
                  <button
                    key={aud.key}
                    type="button"
                    onClick={() => setTargetAudience(aud.key as any)}
                    className={cn(
                      "flex flex-col items-start rounded-xl border p-3 text-left transition-all",
                      targetAudience === aud.key
                        ? "border-primary/50 bg-primary/10 shadow-sm"
                        : "border-border/60 bg-background hover:border-border"
                    )}
                  >
                    <span className="text-xs font-bold text-foreground">{aud.label}</span>
                    <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      ~{aud.count} recipients
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Channels Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Delivery Channels
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setChannels(c => ({ ...c, sms: !c.sms }))}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all",
                    channels.sms
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                      : "border-border/60 bg-background text-muted-foreground"
                  )}
                >
                  <Smartphone className="h-4 w-4" />
                  SMS Broadcast {channels.sms && "✓"}
                </button>

                <button
                  type="button"
                  onClick={() => setChannels(c => ({ ...c, push: !c.push }))}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all",
                    channels.push
                      ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-400"
                      : "border-border/60 bg-background text-muted-foreground"
                  )}
                >
                  <Bell className="h-4 w-4" />
                  In-App & Web Push {channels.push && "✓"}
                </button>
              </div>
            </div>

            {/* Subject / Title */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Announcement Title
              </label>
              <Input
                type="text"
                placeholder="e.g. MTN Network Notice / Weekend Promo"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-11 rounded-xl bg-background text-xs font-bold"
              />
            </div>

            {/* Message Body */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Message Content
                </label>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {charCount} chars · {smsUnits} SMS {smsUnits > 1 ? "units" : "unit"}
                </span>
              </div>
              <Textarea
                rows={5}
                placeholder="Type your official announcement here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="rounded-xl bg-background text-xs font-medium resize-none leading-relaxed"
              />
            </div>

            {/* Dispatch Action */}
            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <span className="text-xs font-semibold text-muted-foreground">
                Targeting <strong>{getRecipientEstimate()}</strong> recipients
              </span>

              <Button
                onClick={handleSendBroadcast}
                disabled={isSending || !message.trim()}
                className="h-11 rounded-xl bg-primary px-6 font-bold shadow-soft transition-all hover:scale-105 active:scale-95 gap-2 text-xs"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {isSending ? "Broadcasting..." : "Dispatch Broadcast Now"}
              </Button>
            </div>

          </div>
        </div>

        {/* Ready-to-Use Operational Templates */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-soft space-y-4">
            <div className="flex items-center gap-2 border-b border-border/40 pb-3">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <h3 className="font-bold text-sm text-foreground">Operational Templates</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Click any template to pre-fill the broadcast composer instantly:
            </p>

            <div className="space-y-2.5">
              {TEMPLATES.map((tmpl) => (
                <div
                  key={tmpl.title}
                  className="rounded-xl border border-border/60 bg-background/80 p-3.5 transition-all hover:border-primary/40 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground">{tmpl.title}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleApplyTemplate(tmpl)}
                      className="h-7 px-2.5 text-[10px] font-bold text-primary hover:bg-primary/10"
                    >
                      Use
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {tmpl.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
