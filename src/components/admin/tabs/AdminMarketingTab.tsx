import { useState } from "react";
import { BellRing, Loader2, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { NOTIFICATION_SOUNDS } from "@/components/ui/InAppNotificationListener";

export function AdminMarketingTab() {
  const { toast } = useToast();
  const [audience, setAudience] = useState("all");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const [pushTitle, setPushTitle] = useState("");
  const [pushMessage, setPushMessage] = useState("");
  const [pushType, setPushType] = useState("info");
  const [pushSound, setPushSound] = useState("default");
  const [pushing, setPushing] = useState(false);

  const PUSH_TEMPLATES = [
    { label: "-- Select Template --", title: "", message: "", type: "info", sound: "default" },
    { label: "System Maintenance", title: "Scheduled Maintenance 🛠️", message: "Our system will undergo brief maintenance shortly. Expect 15 mins of downtime.", type: "info", sound: "alert" },
    { label: "Flash Sale Promo", title: "Flash Sale! 🎉", message: "Get 10% extra on all MTN data purchases for the next 2 hours!", type: "success", sound: "success" },
    { label: "Network Issue (MTN)", title: "MTN Network Delay ⚠️", message: "We are currently experiencing delays with MTN data deliveries. We are monitoring the situation.", type: "error", sound: "alert" },
    { label: "Network Resolved", title: "Network Issues Resolved ✅", message: "All pending data orders have been delivered. Thank you for your patience!", type: "success", sound: "success" },
    { label: "Agent Bonus", title: "Agent Bonus Received! 💰", message: "Congratulations! You've received a bonus in your wallet for reaching your weekly target.", type: "success", sound: "paystack" },
    { label: "Wallet Top-Up Promo", title: "Top Up Bonus 🎁", message: "Fund your wallet with GHS 100 or more today and get a free 1GB data bundle!", type: "info", sound: "default" },
    { label: "New Feature", title: "New Feature Alert 🚀", message: "You can now copy your order receipts directly from your dashboard!", type: "info", sound: "success" },
    { label: "Failed Order Refund", title: "Order Refunded 💸", message: "Your recent failed order has been fully refunded to your wallet.", type: "info", sound: "paystack" },
    { label: "Weekend Special", title: "Weekend Special! 🌟", message: "Happy weekend! Enjoy seamless data top-ups with zero transaction fees today.", type: "success", sound: "default" },
    { label: "Security Notice", title: "Security Reminder 🔒", message: "Never share your password or OTP with anyone. Our staff will never ask for it.", type: "error", sound: "alert" },
  ];

  const SMS_TEMPLATES = [
    { label: "-- Select SMS Template --", message: "" },
    { label: "Scheduled Maintenance", message: "OneGig Update: Our system will undergo brief maintenance from 12AM to 1AM tonight. We apologize for the inconvenience." },
    { label: "Flash Sale Promo", message: "Flash Sale! Get 10% extra on all MTN data purchases at OneGig for the next 2 hours! Buy now at onegig.com" },
    { label: "Network Issue (MTN)", message: "Notice: We are currently experiencing delays with MTN data deliveries. Our team is monitoring the situation." },
    { label: "Network Resolved", message: "Update: All MTN network issues have been resolved! Your pending data orders have been processed. Thank you for your patience." },
    { label: "Agent Promo", message: "Agent Alert: Sell over GHS 500 this week and earn a special bonus credited directly to your OneGig wallet!" },
    { label: "Welcome Bonus", message: "Welcome to OneGig! Get a free 500MB bonus on your first data purchase of GHS 20 or more today." },
    { label: "Price Drop Alert", message: "Great News! We've dropped prices on all Telecel data bundles. Check out the new rates on your dashboard today." },
    { label: "Weekend Special", message: "Happy Weekend! Top up your data on OneGig with zero transaction fees all weekend long. Stay connected!" },
    { label: "Account Security", message: "Security Reminder: OneGig staff will never call to ask for your password or OTP. Please keep your account details secure." },
    { label: "Holiday Greeting", message: "Happy Holidays from OneGig! Enjoy 5% cashback on all data purchases today to celebrate the season with loved ones." },
  ];

  const handleSend = async () => {
    if (!message.trim()) {
      toast({ title: "Error", description: "Message cannot be empty.", variant: "destructive" });
      return;
    }
    if (!window.confirm("Are you sure you want to send this SMS campaign? This may cost credits.")) return;
    
    setSending(true);
    const { error } = await supabase.functions.invoke("send-campaign-sms", {
      body: { audience, message },
    });
    setSending(false);

    if (error) {
      toast({ title: "Campaign failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Campaign sent successfully", description: "SMS messages are being dispatched in the background." });
    setMessage("");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="overflow-hidden rounded-[2rem] border border-border/45 bg-card/30 backdrop-blur-md shadow-soft">
        <div className="border-b border-border/40 bg-card/50 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-black tracking-tight text-foreground">SMS Marketing</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Send bulk SMS messages to users or agents.</p>
        </div>

        <div className="p-6 space-y-6 max-w-2xl">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Select Audience</label>
            <select 
              value={audience} 
              onChange={(e) => setAudience(e.target.value)}
              className="w-full rounded-xl border border-border/65 bg-background/50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 transition-all text-foreground cursor-pointer"
            >
              <option value="all">All Users</option>
              <option value="agents">All Agents</option>
            </select>
          </div>

          <div className="space-y-2 pb-4 border-b border-border/30">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Load SMS Template (Optional)</label>
            <select 
              onChange={(e) => {
                const tmpl = SMS_TEMPLATES[Number(e.target.value)];
                if (tmpl && tmpl.label !== "-- Select SMS Template --") {
                  setMessage(tmpl.message);
                }
              }}
              className="w-full rounded-xl border border-border/60 bg-primary/5 px-4 py-3 text-sm font-black outline-none focus:ring-2 focus:ring-primary/25 transition-all text-primary cursor-pointer"
            >
              {SMS_TEMPLATES.map((t, idx) => (
                <option key={idx} value={idx}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your SMS campaign message here..."
              className="w-full min-h-[120px] rounded-xl border border-border/60 bg-background/50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none text-foreground placeholder:text-muted-foreground/40"
            />
            <p className="text-[10px] font-black text-muted-foreground/80 text-right uppercase tracking-wider">{message.length} characters</p>
          </div>

          <Button 
            onClick={handleSend} 
            disabled={sending || !message.trim()}
            className="w-full sm:w-auto h-11 rounded-xl bg-primary px-8 font-bold shadow-soft transition-all hover:scale-105 active:scale-95 text-xs"
          >
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Megaphone className="mr-2 h-4 w-4" />}
            Send Campaign
          </Button>
        </div>
      </div>
      
      <div className="overflow-hidden rounded-[2rem] border border-border/45 bg-card/30 backdrop-blur-md shadow-soft">
        <div className="border-b border-border/40 bg-card/50 p-6">
          <div className="flex items-center gap-2 mb-2">
            <BellRing className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-black tracking-tight text-foreground">In-App Push Notifications</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Send real-time alerts with sound to all users currently online.</p>
        </div>

        <div className="p-6 space-y-6 max-w-2xl">
          <div className="space-y-2 pb-4 border-b border-border/30">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Load Template (Optional)</label>
            <select 
              onChange={(e) => {
                const tmpl = PUSH_TEMPLATES[Number(e.target.value)];
                if (tmpl && tmpl.label !== "-- Select Template --") {
                  setPushTitle(tmpl.title);
                  setPushMessage(tmpl.message);
                  setPushType(tmpl.type);
                  setPushSound(tmpl.sound);
                }
              }}
              className="w-full rounded-xl border border-border/60 bg-primary/5 px-4 py-3 text-sm font-black outline-none focus:ring-2 focus:ring-primary/25 transition-all text-primary cursor-pointer"
            >
              {PUSH_TEMPLATES.map((t, idx) => (
                <option key={idx} value={idx}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Title</label>
            <Input 
              value={pushTitle} 
              onChange={(e) => setPushTitle(e.target.value)} 
              placeholder="e.g. System Maintenance" 
              className="h-11 rounded-xl bg-background/50 font-semibold text-sm border-border/60" 
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Message</label>
            <textarea
              value={pushMessage}
              onChange={(e) => setPushMessage(e.target.value)}
              placeholder="Your notification message..."
              className="w-full min-h-[100px] rounded-xl border border-border/60 bg-background/50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none text-foreground placeholder:text-muted-foreground/45"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Type</label>
              <select 
                value={pushType} 
                onChange={(e) => setPushType(e.target.value)}
                className="w-full rounded-xl border border-border/60 bg-background/50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 transition-all text-foreground cursor-pointer"
              >
                <option value="info">Info (Default)</option>
                <option value="success">Success</option>
                <option value="error">Error/Warning</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Sound</label>
              <select 
                value={pushSound} 
                onChange={(e) => {
                  setPushSound(e.target.value);
                  const url = NOTIFICATION_SOUNDS[e.target.value as keyof typeof NOTIFICATION_SOUNDS] || NOTIFICATION_SOUNDS.default;
                  const audio = new Audio(url);
                  audio.volume = 0.8;
                  audio.play().catch(() => {});
                }}
                className="w-full rounded-xl border border-border/60 bg-background/50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 transition-all text-foreground cursor-pointer"
              >
                <option value="default">Pop (Default)</option>
                <option value="success">Chime (Success)</option>
                <option value="paystack">Coin Drop (Paystack-like)</option>
                <option value="alert">Alert (Urgent)</option>
              </select>
            </div>
          </div>

          <Button 
            onClick={async () => {
              if (!pushTitle.trim() || !pushMessage.trim()) return toast({ title: "Error", description: "Title and message required.", variant: "destructive" });
              setPushing(true);
              const { error } = await supabase.from('app_notifications').insert({
                title: pushTitle,
                message: pushMessage,
                type: pushType,
                sound_name: pushSound,
                is_global: true
              });
              setPushing(false);
              if (error) {
                toast({ title: "Failed to send", description: error.message, variant: "destructive" });
              } else {
                toast({ title: "Notification Sent", description: "Sent to all active users instantly." });
                setPushTitle("");
                setPushMessage("");
              }
            }} 
            disabled={pushing || !pushTitle.trim() || !pushMessage.trim()}
            className="w-full sm:w-auto h-11 rounded-xl bg-primary px-8 font-bold shadow-soft transition-all hover:scale-105 active:scale-95 text-xs"
          >
            {pushing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellRing className="mr-2 h-4 w-4" />}
            Send Push Notification
          </Button>
        </div>
      </div>
    </div>
  );
}
