import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function AdminSettingsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [supportPhone, setSupportPhone] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [whatsappLink, setWhatsappLink] = useState("");
  const [telegramLink, setTelegramLink] = useState("");
  const [twitterHandle, setTwitterHandle] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [allowRegistrations, setAllowRegistrations] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [homePageBg, setHomePageBg] = useState("/bg-ancient-1.png");
  const [homePageBgVideo, setHomePageBgVideo] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [notice, setNotice]             = useState("");
  const [activePaymentGateway, setActivePaymentGateway] = useState("paystack");
  const [paystackSecretKey, setPaystackSecretKey] = useState("");
  const [thetellerMerchantId, setThetellerMerchantId] = useState("");
  const [thetellerApiKey, setThetellerApiKey] = useState("");
  const [smsOtpEnabled, setSmsOtpEnabled] = useState(true);
  const [txtconnectApiKey, setTxtconnectApiKey] = useState("");
  const [smsSenderId, setSmsSenderId] = useState("OneGig");

  useQuery({
    queryKey: ["admin-site-settings"],
    queryFn: async () => {
      const { data: rows } = await supabase.from("app_settings").select("key, value");
      const map: Record<string, any> = {};
      (rows ?? []).forEach((r: any) => (map[r.key] = r.value));
      setSupportPhone(String(map.support_phone ?? ""));
      setSupportEmail(String(map.support_email ?? ""));
      setWhatsappLink(String(map.whatsapp_group_link ?? ""));
      setTelegramLink(String(map.telegram_link ?? ""));
      setTwitterHandle(String(map.twitter_handle ?? ""));
      setInstagramHandle(String(map.instagram_handle ?? ""));
      setAllowRegistrations(map.allow_registrations !== "false");
      setMaintenanceMode(map.maintenance_mode === "true");
      setHomePageBg(String(map.home_page_bg || "/bg-ancient-1.png"));
      setHomePageBgVideo(String(map.home_page_bg_video ?? ""));
      setNotice(String(map.popup_notice ?? ""));
      setActivePaymentGateway(String(map.active_payment_gateway ?? "paystack"));
      setPaystackSecretKey(String(map.paystack_secret_key ?? ""));
      setThetellerMerchantId(String(map.theteller_merchant_id ?? ""));
      setThetellerApiKey(String(map.theteller_api_key ?? ""));
      setSmsOtpEnabled(map.sms_otp_enabled !== "false");
      setTxtconnectApiKey(String(map.txtconnect_api_key ?? ""));
      setSmsSenderId(String(map.sms_sender_id ?? "OneGig"));
      return true;
    },
    staleTime: 60_000,
  });

  const saveSettings = async () => {
    const rows = [
      { key: "support_phone",       value: supportPhone },
      { key: "support_email",       value: supportEmail },
      { key: "whatsapp_group_link", value: whatsappLink },
      { key: "telegram_link",       value: telegramLink },
      { key: "twitter_handle",      value: twitterHandle },
      { key: "instagram_handle",    value: instagramHandle },
      { key: "popup_notice",        value: notice },
      { key: "home_page_bg",        value: homePageBg },
      { key: "home_page_bg_video",  value: homePageBgVideo },
      { key: "allow_registrations", value: String(allowRegistrations) },
      { key: "maintenance_mode",    value: String(maintenanceMode) },
      { key: "active_payment_gateway", value: activePaymentGateway },
      { key: "paystack_secret_key", value: paystackSecretKey },
      { key: "theteller_merchant_id", value: thetellerMerchantId },
      { key: "theteller_api_key", value: thetellerApiKey },
      { key: "sms_otp_enabled",     value: String(smsOtpEnabled) },
      { key: "txtconnect_api_key",  value: txtconnectApiKey },
      { key: "sms_sender_id",       value: smsSenderId },
    ];
    const { error } = await supabase.from("app_settings").upsert(rows as any);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "System configuration updated" });
    qc.invalidateQueries({ queryKey: ["app_settings"] });
  };

  return (
    <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card/30 backdrop-blur-md shadow-soft animate-in fade-in duration-300">
      <div className="border-b border-border/40 bg-card/50 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Platform Configuration</h2>
          <p className="text-sm text-muted-foreground">Adjust support channels, social links, and system controls.</p>
        </div>
        <Button className="h-11 w-full sm:w-auto rounded-xl bg-primary px-8 font-bold shadow-soft transition-all hover:scale-105 active:scale-95" onClick={saveSettings}>
          <BellRing className="mr-2 h-4 w-4" /> Save Config
        </Button>
      </div>

      <div className="p-6 md:p-8 space-y-8">
        <div>
          <h3 className="mb-3 text-sm font-bold text-foreground">Contact & Social Links</h3>
          <div className="overflow-hidden rounded-[20px] border border-border/50 bg-background/30 shadow-sm transition-all focus-within:shadow-md focus-within:border-border/80">
            <div className="group relative border-b border-border/50 p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Support Hotline</label>
              <input value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} placeholder="+233…" className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-right" />
            </div>
            
            <div className="group relative border-b border-border/50 p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Support Email</label>
              <input value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="help@onegig.com" className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-right" />
            </div>

            <div className="group relative border-b border-border/50 p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">WhatsApp Group</label>
              <input value={whatsappLink} onChange={(e) => setWhatsappLink(e.target.value)} placeholder="https://chat.whatsapp.com/…" className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-right" />
            </div>

            <div className="group relative border-b border-border/50 p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Telegram Group</label>
              <input value={telegramLink} onChange={(e) => setTelegramLink(e.target.value)} placeholder="https://t.me/…" className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-right" />
            </div>

            <div className="group relative border-b border-border/50 p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Twitter Handle</label>
              <input value={twitterHandle} onChange={(e) => setTwitterHandle(e.target.value)} placeholder="@onegig_app" className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-right" />
            </div>

            <div className="group relative p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Instagram Handle</label>
              <input value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)} placeholder="@onegig.app" className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-right" />
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold text-foreground">Appearance & Branding</h3>
          <div className="overflow-hidden rounded-[20px] border border-border/50 bg-background/30 shadow-sm transition-all focus-within:shadow-md focus-within:border-border/80">
            <div className="group relative border-b border-border/50 p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Home Page Background</label>
              <select 
                value={["/bg-ancient-1.png", "/bg-ancient-2.png", "/bg-ancient-3.png", "none"].includes(homePageBg) ? homePageBg : "custom"} 
                onChange={(e) => setHomePageBg(e.target.value === "custom" ? "" : e.target.value)} 
                className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none sm:text-right appearance-none"
              >
                <option value="/bg-ancient-1.png">Theme 1: Deep Purple Adinkra & Money</option>
                <option value="/bg-ancient-2.png">Theme 2: Navy Blue Egyptian & Digital</option>
                <option value="/bg-ancient-3.png">Theme 3: Slate Neon Tribal Patterns</option>
                <option value="none">Solid Color (None)</option>
                <option value="custom">Custom Image or Animated GIF URL</option>
              </select>
            </div>

            {!["/bg-ancient-1.png", "/bg-ancient-2.png", "/bg-ancient-3.png", "none"].includes(homePageBg) && (
              <div className="group relative border-b border-border/50 p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2 bg-primary/5">
                <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-primary">Upload or Paste GIF Link</label>
                <div className="flex-1 flex gap-2">
                  <input 
                    value={homePageBg.startsWith('data:') ? 'Uploaded File Selected' : homePageBg} 
                    onChange={(e) => setHomePageBg(e.target.value)} 
                    placeholder="https://example.com/my-animated-background.gif"
                    className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none sm:text-right" 
                    readOnly={homePageBg.startsWith('data:')}
                  />
                  <Button variant="outline" size="sm" onClick={() => document.getElementById('bg-upload')?.click()}>
                    Upload GIF
                  </Button>
                  <input 
                    id="bg-upload" 
                    type="file" 
                    accept="image/gif,image/jpeg,image/png,image/webp" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 2 * 1024 * 1024) {
                        alert("File too large. Please use a GIF under 2MB.");
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => setHomePageBg(reader.result as string);
                      reader.readAsDataURL(file);
                    }}
                  />
                </div>
              </div>
            )}
            
            {homePageBg && homePageBg !== "none" && homePageBg.length > 5 && (
              <div className="p-4 bg-secondary/10 flex justify-center">
                <img src={homePageBg} alt="Background Preview" className="h-32 w-auto object-cover rounded-xl border border-border/50 shadow-sm opacity-80" />
              </div>
            )}

            <div className="group relative border-b border-border/50 p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2 bg-primary/5">
              <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-primary">Home Page Background Video</label>
              <div className="flex-1 flex gap-2">
                <input 
                  value={homePageBgVideo} 
                  onChange={(e) => setHomePageBgVideo(e.target.value)} 
                  placeholder="https://example.com/background.mp4"
                  className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none sm:text-right" 
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={uploadingVideo}
                  onClick={() => document.getElementById('video-upload')?.click()}
                >
                  {uploadingVideo ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  Upload Video
                </Button>
                <input 
                  id="video-upload" 
                  type="file" 
                  accept="video/mp4,video/webm" 
                  className="hidden" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !user) return;
                    
                    if (file.size > 10 * 1024 * 1024) {
                      alert("Video file too large. Please use a video under 10MB for optimal loading speed.");
                      return;
                    }
                    
                    setUploadingVideo(true);
                    try {
                      const fileExt = file.name.split('.').pop();
                      const filePath = `${user.id}/homepage-bg-video-${Date.now()}.${fileExt}`;
                      
                      const { error } = await supabase.storage
                        .from('store-logos')
                        .upload(filePath, file, { cacheControl: '3600', upsert: true });
                        
                      if (error) throw error;
                      
                      const { data: { publicUrl } } = supabase.storage
                        .from('store-logos')
                        .getPublicUrl(filePath);
                        
                      setHomePageBgVideo(publicUrl);
                      toast({ title: "Video uploaded successfully!" });
                    } catch (err: any) {
                      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
                    } finally {
                      setUploadingVideo(false);
                    }
                  }}
                />
              </div>
            </div>

            {homePageBgVideo && (
              <div className="p-5 bg-secondary/15 flex flex-col items-center gap-3 border-t border-border/30">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Background Video Preview & Controls</p>
                <video 
                  src={homePageBgVideo} 
                  controls 
                  preload="metadata"
                  className="h-44 w-auto object-cover rounded-2xl border border-border/50 shadow-lg" 
                />
                <button 
                  type="button" 
                  onClick={() => setHomePageBgVideo("")}
                  className="text-xs font-black text-rose-500 hover:text-rose-600 transition-colors"
                >
                  Remove Video
                </button>
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold text-foreground">Payment Gateways</h3>
          <div className="overflow-hidden rounded-[20px] border border-border/50 bg-background/30 shadow-sm transition-all focus-within:shadow-md focus-within:border-border/80">
            <div className="group relative border-b border-border/50 p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Active Payment Gateway</label>
              <select 
                value={activePaymentGateway} 
                onChange={(e) => setActivePaymentGateway(e.target.value)} 
                className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none sm:text-right appearance-none cursor-pointer"
              >
                <option value="paystack">Paystack</option>
                <option value="theteller">theTeller</option>
              </select>
            </div>

            {activePaymentGateway === "paystack" ? (
              <div className="group relative p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Paystack Secret Key</label>
                <input 
                  type="password" 
                  value={paystackSecretKey} 
                  onChange={(e) => setPaystackSecretKey(e.target.value)} 
                  placeholder="sk_live_..." 
                  className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-right" 
                />
              </div>
            ) : (
              <>
                <div className="group relative border-b border-border/50 p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2">
                  <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">theTeller Merchant ID</label>
                  <input 
                    type="text" 
                    value={thetellerMerchantId} 
                    onChange={(e) => setThetellerMerchantId(e.target.value)} 
                    placeholder="e.g. merchant_id" 
                    className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-right" 
                  />
                </div>
                <div className="group relative p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2">
                  <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">theTeller API Key</label>
                  <input 
                    type="password" 
                    value={thetellerApiKey} 
                    onChange={(e) => setThetellerApiKey(e.target.value)} 
                    placeholder="API Key" 
                    className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-right" 
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold text-foreground">System Controls</h3>
          <div className="overflow-hidden rounded-[20px] border border-border/50 bg-background/30 shadow-sm">
            <div className="group relative border-b border-border/50 p-4 transition-colors hover:bg-accent/20 flex items-center justify-between gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Allow New Registrations</label>
                <p className="text-xs text-muted-foreground/80 mt-1">If disabled, new users cannot sign up.</p>
              </div>
              <button 
                type="button" 
                onClick={() => setAllowRegistrations(!allowRegistrations)} 
                className={cn("relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors", allowRegistrations ? "bg-emerald-500" : "bg-muted")}
              >
                <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform", allowRegistrations ? "translate-x-6" : "translate-x-1")} />
              </button>
            </div>

            <div className="group relative border-b border-border/50 p-4 transition-colors hover:bg-accent/20 flex items-center justify-between gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Enable SMS OTP Verification</label>
                <p className="text-xs text-muted-foreground/80 mt-1">If disabled, phone number verification OTP is bypassed.</p>
              </div>
              <button 
                type="button" 
                onClick={() => setSmsOtpEnabled(!smsOtpEnabled)} 
                className={cn("relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors", smsOtpEnabled ? "bg-emerald-500" : "bg-muted")}
              >
                <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform", smsOtpEnabled ? "translate-x-6" : "translate-x-1")} />
              </button>
            </div>

            <div className="group relative p-4 transition-colors hover:bg-accent/20 flex items-center justify-between gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-rose-500">Maintenance Mode</label>
                <p className="text-xs text-muted-foreground/80 mt-1">If enabled, the platform is locked for everyone except Admins.</p>
              </div>
              <button 
                type="button" 
                onClick={() => setMaintenanceMode(!maintenanceMode)} 
                className={cn("relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors", maintenanceMode ? "bg-rose-500" : "bg-muted")}
              >
                <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform", maintenanceMode ? "translate-x-6" : "translate-x-1")} />
              </button>
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold text-foreground">SMS Gateway Configuration</h3>
          <div className="overflow-hidden rounded-[20px] border border-border/50 bg-background/30 shadow-sm transition-all focus-within:shadow-md focus-within:border-border/80">
            <div className="group relative border-b border-border/50 p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">TXTConnect API Key</label>
              <input 
                type="password" 
                value={txtconnectApiKey} 
                onChange={(e) => setTxtconnectApiKey(e.target.value)} 
                placeholder="Enter API key" 
                className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-right" 
              />
            </div>
            <div className="group relative p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">SMS Sender ID</label>
              <input 
                type="text" 
                value={smsSenderId} 
                onChange={(e) => setSmsSenderId(e.target.value)} 
                placeholder="OneGig" 
                className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-right" 
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold text-foreground">Global Platform Notice</h3>
          <div className="overflow-hidden rounded-[20px] border border-border/50 bg-background/30 shadow-sm transition-all focus-within:shadow-md focus-within:border-border/80">
            <div className="group relative p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30">
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Platform-Wide Notice Text</label>
              <textarea
                value={notice}
                onChange={(e) => setNotice(e.target.value)}
                placeholder="Important update or promotional notice for all users…"
                className="min-h-[100px] w-full resize-none bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/40"
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
