import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Megaphone, Paintbrush } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { subscribeToPushNotifications } from "@/lib/push";
import { cn } from "@/lib/utils";

export function AgentSettingsTab({ agentProfile }: { agentProfile: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    store_name: agentProfile.store_name ?? "",
    store_tagline: agentProfile.store_tagline ?? "",
    store_brand_color: agentProfile.store_brand_color ?? "#7c3aed",
    store_logo_url: agentProfile.store_logo_url ?? "",
    support_whatsapp: agentProfile.support_whatsapp ?? "",
    support_phone: agentProfile.support_phone ?? "",
    custom_domain: agentProfile.custom_domain ?? "",
    store_promo_banner: agentProfile.store_promo_banner ?? "",
    store_promo_banner_style: agentProfile.store_promo_banner_style ?? "neon-flash",
    store_template_theme: agentProfile.store_template_theme ?? "minimalist",
    store_font_family: agentProfile.store_font_family ?? "Inter",
    store_dark_mode: agentProfile.store_dark_mode ?? false,
  });
  const [widgetEnabled, setWidgetEnabled] = useState(() => {
    return localStorage.getItem("og_whatsapp_widget") !== "false";
  });
  const [pushEnabled, setPushEnabled] = useState(Notification.permission === "granted");
  const [saving, setSaving] = useState(false);

  const f = (key: keyof typeof form, val: any) => setForm((p) => ({ ...p, [key]: val }));

  const save = async () => {
    setSaving(true);
    localStorage.setItem("og_whatsapp_widget", String(widgetEnabled));

    if (pushEnabled && Notification.permission !== "granted") {
      const success = await subscribeToPushNotifications(agentProfile.user_id);
      if (success) {
        setPushEnabled(true);
        toast({ title: "Push Notifications Enabled", description: "You will now receive alerts for new sales." });
      } else {
        setPushEnabled(false);
      }
    }

    const { error } = await supabase.from("agent_profiles").update({
      store_name: form.store_name,
      store_tagline: form.store_tagline || null,
      store_brand_color: form.store_brand_color || null,
      store_logo_url: form.store_logo_url || null,
      support_whatsapp: form.support_whatsapp || null,
      support_phone: form.support_phone || null,
      custom_domain: form.custom_domain || null,
      store_promo_banner: form.store_promo_banner || null,
      store_promo_banner_style: form.store_promo_banner_style || "neon-flash",
      store_template_theme: form.store_template_theme,
      store_font_family: form.store_font_family,
      store_dark_mode: form.store_dark_mode,
    } as any).eq("id", agentProfile.id);
    setSaving(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Store settings saved" });
    qc.invalidateQueries({ queryKey: ["my-agent-profile"] });
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft animate-in fade-in duration-300">
      <div className="border-b border-border/60 bg-[#080c1a] px-5 py-4 md:px-6">
        <h2 className="text-base font-bold text-white">Store Settings</h2>
        <p className="mt-0.5 text-xs text-white/50">Customize how your public store looks and feels.</p>
      </div>

      <div className="p-5 md:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-foreground">Store Name</label>
            <Input className="h-11 rounded-xl" value={form.store_name} onChange={(e) => f("store_name", e.target.value)} placeholder="My Data Store" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-foreground">Tagline <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input className="h-11 rounded-xl" value={form.store_tagline} onChange={(e) => f("store_tagline", e.target.value)} placeholder="Fast & affordable data bundles" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-foreground">Custom Domain <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input className="h-11 rounded-xl" value={form.custom_domain} onChange={(e) => f("custom_domain", e.target.value)} placeholder="e.g. data.mystore.com" />
            <p className="text-[10px] text-muted-foreground mt-1">Point your domain's CNAME or A-record to our platform, then enter the domain here without https://</p>
          </div>
          <div className="space-y-3 md:col-span-2">
            <label className="text-xs font-semibold text-foreground">Logo URL or Select Profile Avatar</label>
            <div className="flex gap-2">
              <Input className="h-11 flex-1 rounded-xl" value={form.store_logo_url.startsWith('data:image/svg+xml') ? 'Emoji Selected' : form.store_logo_url.startsWith('https://api.dicebear.com') ? '3D Avatar Selected' : form.store_logo_url} onChange={(e) => f("store_logo_url", e.target.value)} placeholder="https://example.com/logo.png" readOnly={form.store_logo_url.startsWith('data:image/svg+xml') || form.store_logo_url.startsWith('https://api.dicebear.com')} />
              {(form.store_logo_url.startsWith('data:image/svg+xml') || form.store_logo_url.startsWith('https://api.dicebear.com')) && (
                <Button variant="outline" type="button" onClick={() => f("store_logo_url", "")}>Clear</Button>
              )}
            </div>
            
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">3D Avatars</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  "https://api.dicebear.com/9.x/adventurer/svg?seed=Felix",
                  "https://api.dicebear.com/9.x/adventurer/svg?seed=Aneka",
                  "https://api.dicebear.com/9.x/adventurer/svg?seed=Jasper",
                  "https://api.dicebear.com/9.x/adventurer/svg?seed=Max",
                  "https://api.dicebear.com/9.x/adventurer/svg?seed=Bella",
                  "https://api.dicebear.com/9.x/notionists/svg?seed=Leo",
                  "https://api.dicebear.com/9.x/notionists/svg?seed=Zoe",
                  "https://api.dicebear.com/9.x/notionists/svg?seed=Jack",
                  "https://api.dicebear.com/9.x/notionists/svg?seed=Oliver",
                  "https://api.dicebear.com/9.x/notionists/svg?seed=Mia"
                ].map(avatar => (
                  <button
                    key={avatar}
                    type="button"
                    onClick={() => f("store_logo_url", avatar)}
                    className="h-12 w-12 flex items-center justify-center rounded-xl border border-border/50 bg-secondary/30 hover:bg-secondary transition-colors overflow-hidden shadow-sm"
                  >
                    <img src={avatar} alt="Avatar" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Emojis</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {["🚀", "💎", "🌟", "🔥", "👑", "⚡", "🎯", "💼", "🛒", "🛍️", "📱", "🛡️", "💰", "💸", "💳", "👨‍💼", "👩‍💼", "🦸‍♂️", "🦹‍♂️", "🦁", "🦅", "😎", "👾", "🦊", "🐻"].map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => f("store_logo_url", `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${emoji}</text></svg>`)}`)}
                    className="h-10 w-10 flex items-center justify-center rounded-xl border border-border/50 bg-secondary/30 hover:bg-secondary transition-colors text-2xl shadow-sm"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-foreground">Brand Color Presets & Custom Picker</label>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Rose Ruby", hex: "#f43f5e", bg: "bg-rose-500" },
                  { label: "Royal Indigo", hex: "#6366f1", bg: "bg-indigo-500" },
                  { label: "Amber Gold", hex: "#d97706", bg: "bg-amber-600" },
                  { label: "Emerald Mint", hex: "#10b981", bg: "bg-emerald-500" },
                  { label: "Violet Iris", hex: "#8b5cf6", bg: "bg-violet-500" },
                ].map(preset => {
                  const isMatch = form.store_brand_color?.toLowerCase() === preset.hex.toLowerCase();
                  return (
                    <button
                      type="button"
                      key={preset.hex}
                      onClick={() => f("store_brand_color", preset.hex)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all",
                        isMatch
                          ? "border-primary ring-2 ring-primary bg-primary/5 text-primary"
                          : "border-border hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className={cn("h-3 w-3 rounded-full shadow-sm shrink-0", preset.bg)} />
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Brand colour picker"
                  title="Brand colour picker"
                  value={form.store_brand_color}
                  onChange={(e) => f("store_brand_color", e.target.value)}
                  className="h-11 w-11 cursor-pointer rounded-xl border border-border bg-background p-1"
                />
                <Input className="h-11 flex-1 rounded-xl" value={form.store_brand_color} onChange={(e) => f("store_brand_color", e.target.value)} placeholder="#7c3aed" />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">WhatsApp</label>
            <Input className="h-11 rounded-xl" value={form.support_whatsapp} onChange={(e) => f("support_whatsapp", e.target.value)} placeholder="e.g. 024 000 0000" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Support Phone</label>
            <Input className="h-11 rounded-xl" value={form.support_phone} onChange={(e) => f("support_phone", e.target.value)} placeholder="e.g. 024 000 0000" />
          </div>
          
          <div className="space-y-1.5 md:col-span-2 pt-2 border-t border-border/40">
            <h4 className="text-xs font-black text-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Megaphone className="h-4 w-4 text-rose-500 animate-pulse" /> Top 50 Promo Banner Alert
            </h4>
            <p className="text-[11px] text-muted-foreground">Broadcast high-converting promo alerts at the very top of your storefront page.</p>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-foreground">Promo Announcement Alert Text</label>
            <Input className="h-11 rounded-xl" value={form.store_promo_banner} onChange={(e) => f("store_promo_banner", e.target.value)} placeholder="e.g. ✨ MTN WEEKEND RUSH! MTN 10GB now at GH₵ 11.50 only! Ends Sunday midnight! ⚡" />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-foreground">Promo Ticker Design Theme</label>
            <select
              aria-label="Promo Ticker Design Theme"
              value={form.store_promo_banner_style}
              onChange={(e) => f("store_promo_banner_style", e.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="neon-flash">⚡ Neon Flashing Amber & Rose</option>
              <option value="midnight-gold">👑 Midnight Obsidian & Luxury Gold</option>
              <option value="fire-ruby">🔥 Pulsing Fire Ruby Red</option>
              <option value="success-emerald">✨ Success Emerald Green Pulse</option>
            </select>
          </div>

          <div className="space-y-1.5 md:col-span-2 pt-4 border-t border-border/40">
            <h4 className="text-xs font-black text-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Paintbrush className="h-4 w-4 text-violet-500" /> Premium Theme & Aesthetics Builder
            </h4>
            <p className="text-[11px] text-muted-foreground">Select layouts, custom typographies, and dark modes to command premium reseller rates.</p>
          </div>

          <div className="space-y-3 md:col-span-2">
            <label className="text-xs font-semibold text-foreground">Store Theme Aesthetic</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { id: "minimalist", label: "Minimalist Classic", desc: "Clean borders, slate accents, light & dark support", previewClass: "bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800" },
                { id: "glassmorphism", label: "Glassmorphism", desc: "Frosted translucent glass, backdrop blur overlays", previewClass: "bg-white/20 border-white/30 backdrop-blur-md shadow-lg" },
                { id: "cyberpunk", label: "Cyberpunk Neon", desc: "Dark mode grid with neon cyan border shadows", previewClass: "bg-black border-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.3)] text-cyan-400 font-mono" },
                { id: "luxury", label: "Luxury Stone", desc: "Premium stone-dark backgrounds with luxury gold borders", previewClass: "bg-stone-900 border-amber-500/35 text-stone-100" },
              ].map(t => {
                const active = form.store_template_theme === t.id;
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => f("store_template_theme", t.id)}
                    className={cn(
                      "flex flex-col text-left p-3 rounded-2xl border transition-all h-full justify-between",
                      active ? "border-primary ring-2 ring-primary bg-primary/5" : "border-border hover:bg-secondary/40"
                    )}
                  >
                    <div className="w-full">
                      <div className={cn("w-full h-12 rounded-lg mb-2 border flex items-center justify-center text-[10px] font-bold overflow-hidden", t.previewClass)}>
                        {t.id === "glassmorphism" ? "Glassmorphic" : t.id === "cyberpunk" ? "CYBER_DATA" : t.id === "luxury" ? "⚜️ Luxury" : "Minimalist"}
                      </div>
                      <span className="text-xs font-bold block text-foreground">{t.label}</span>
                      <span className="text-[10px] text-muted-foreground mt-1 block leading-tight">{t.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 md:col-span-2">
            <label className="text-xs font-semibold text-foreground">Google Font Typography</label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {[
                { id: "Inter", label: "Inter", desc: "Classic Clean", style: { fontFamily: "'Inter', sans-serif" } },
                { id: "Outfit", label: "Outfit", desc: "Geometric Modern", style: { fontFamily: "'Outfit', sans-serif" } },
                { id: "Space Grotesk", label: "Space Grotesk", desc: "Tech Accent", style: { fontFamily: "'Space Grotesk', sans-serif" } },
                { id: "Playfair Display", label: "Playfair Display", desc: "Serif Elegance", style: { fontFamily: "'Playfair Display', serif" } },
                { id: "Roboto", label: "Roboto", desc: "Standard Friendly", style: { fontFamily: "'Roboto', sans-serif" } },
              ].map(font => {
                const active = form.store_font_family === font.id;
                return (
                  <button
                    type="button"
                    key={font.id}
                    onClick={() => f("store_font_family", font.id)}
                    className={cn(
                      "flex flex-col p-3 rounded-xl border text-center transition-all justify-between items-center",
                      active ? "border-primary ring-2 ring-primary bg-primary/5" : "border-border hover:bg-secondary/40"
                    )}
                    style={font.style}
                  >
                    <span className="text-sm font-extrabold block text-foreground">Aa</span>
                    <span className="text-xs font-bold block text-foreground mt-1">{font.label}</span>
                    <span className="text-[9px] text-muted-foreground mt-0.5 block leading-tight">{font.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-secondary/30 border border-border/60 rounded-xl md:col-span-2">
            <div>
              <h4 className="font-bold text-foreground text-sm">Force Dark Mode Style</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Toggle storefront default dark mode (overrides client settings).</p>
            </div>
            <button
              type="button"
              onClick={() => f("store_dark_mode", !form.store_dark_mode)}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${form.store_dark_mode ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${form.store_dark_mode ? 'translate-x-8' : 'translate-x-1'}`} />
            </button>
          </div>
          
          <div className="md:col-span-2 pt-2 space-y-3">
            <div className="flex items-center justify-between p-4 bg-secondary/30 border border-border/60 rounded-xl">
              <div>
                <h4 className="font-bold text-foreground">Draggable WhatsApp Button</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Show a floating chat button on your public storefront.</p>
              </div>
              <button
                type="button"
                onClick={() => setWidgetEnabled(!widgetEnabled)}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${widgetEnabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${widgetEnabled ? 'translate-x-8' : 'translate-x-1'}`} />
              </button>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-secondary/30 border border-border/60 rounded-xl">
              <div>
                <h4 className="font-bold text-foreground">Push Notifications</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Receive native notifications for new sales even when closed.</p>
              </div>
              <button
                type="button"
                onClick={() => setPushEnabled(!pushEnabled)}
                disabled={Notification.permission === "granted"}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${pushEnabled || Notification.permission === "granted" ? 'bg-primary' : 'bg-muted-foreground/30'} disabled:opacity-50`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${pushEnabled || Notification.permission === "granted" ? 'translate-x-8' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </div>

        <Button type="button" className="mt-6 h-11 rounded-xl px-8 font-bold gradient-primary shadow-float" disabled={saving} onClick={save}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
