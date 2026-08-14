import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Loader2, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function AgentMarketingTab({ agentProfile }: { agentProfile: any }) {
  const { toast } = useToast();
  const [template, setTemplate] = useState<"obsidian" | "neon" | "gold" | "light">("obsidian");
  const [tagline, setTagline] = useState(agentProfile.store_tagline || "Fast & Affordable Data Bundles");
  const [selectedBundles, setSelectedBundles] = useState<string[]>([]);
  const [qrImage, setQrImage] = useState<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const storeUrl = `${window.location.origin}/store/${agentProfile.store_slug}`;

  // Bulk Broadcaster States & Actions
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastType, setBroadcastType] = useState("info");
  const [broadcastSound, setBroadcastSound] = useState("default");
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;

    setIsBroadcasting(true);
    try {
      const { data: customerOrders, error: orderErr } = await supabase
        .from("orders")
        .select("customer_user_id")
        .eq("agent_id", agentProfile.id)
        .not("customer_user_id", "is", null);

      if (orderErr) throw orderErr;

      const targetUserIds = Array.from(new Set((customerOrders ?? []).map(o => o.customer_user_id)));

      if (targetUserIds.length === 0) {
        toast({
          title: "No registered customers found",
          description: "You don't have any registered storefront buyers with active order histories yet.",
          variant: "destructive"
        });
        setIsBroadcasting(false);
        return;
      }

      const notificationRows = targetUserIds.map(userId => ({
        title: broadcastTitle,
        message: broadcastMessage,
        type: broadcastType,
        sound_name: broadcastSound,
        target_user_id: userId,
        is_global: false
      }));

      const { error: insertErr } = await supabase
        .from("app_notifications")
        .insert(notificationRows);

      if (insertErr) throw insertErr;

      toast({
        title: "Broadcast Successful! 📢",
        description: `Your alert has been sent in real-time to all ${targetUserIds.length} registered customers.`,
      });
      setBroadcastTitle("");
      setBroadcastMessage("");
    } catch (err: any) {
      toast({
        title: "Failed to broadcast alert",
        description: err.message || "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setIsBroadcasting(false);
    }
  };

  const { data: payload, isLoading } = useQuery({
    queryKey: ["marketing-kit-bundles", agentProfile.id],
    queryFn: async () => {
      const [{ data: networks }, { data: bundles }, { data: myPrices }] = await Promise.all([
        supabase.from("networks").select("id, name, code, logo_emoji").eq("active", true),
        supabase.from("bundles").select("id, network_id, size_label, base_price").eq("active", true).order("size_mb"),
        supabase.from("agent_bundle_prices").select("bundle_id, sell_price, active").eq("agent_id", agentProfile.id),
      ]);
      
      const priceMap: Record<string, number> = {};
      (myPrices ?? []).forEach((r: any) => { if (r.active) priceMap[r.bundle_id] = Number(r.sell_price); });
      
      return {
        networks: networks ?? [],
        bundles: (bundles ?? []).map(b => ({
          ...b,
          sellPrice: priceMap[b.id] != null ? priceMap[b.id] : Number(b.base_price),
          network: (networks ?? []).find(n => n.id === b.network_id),
        }))
      };
    }
  });

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(storeUrl)}`;
    img.onload = () => {
      setQrImage(img);
    };
  }, [storeUrl]);

  const featuredBundles = (payload?.bundles ?? []).filter(b => selectedBundles.includes(b.id)).slice(0, 4);

  useEffect(() => {
    if (payload?.bundles && selectedBundles.length === 0) {
      setSelectedBundles(payload.bundles.slice(0, 4).map(b => b.id));
    }
  }, [payload?.bundles]);

  useEffect(() => {
    drawPoster();
  }, [template, tagline, selectedBundles, qrImage, payload]);

  const drawPoster = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 0, 1920);
    if (template === "obsidian") {
      grad.addColorStop(0, "#080b11");
      grad.addColorStop(0.5, "#0f172a");
      grad.addColorStop(1, "#030712");
    } else if (template === "neon") {
      grad.addColorStop(0, "#011612");
      grad.addColorStop(0.5, "#022c22");
      grad.addColorStop(1, "#010f0c");
    } else if (template === "gold") {
      grad.addColorStop(0, "#1c1917");
      grad.addColorStop(0.5, "#0c0a09");
      grad.addColorStop(1, "#1c1917");
    } else if (template === "light") {
      grad.addColorStop(0, "#f8fafc");
      grad.addColorStop(0.5, "#f1f5f9");
      grad.addColorStop(1, "#e2e8f0");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    const textColor = template === "light" ? "#0f172a" : "#ffffff";
    const subColor = template === "light" ? "#475569" : "#94a3b8";
    const accentColor = template === "obsidian" ? "#f43f5e" : template === "neon" ? "#10b981" : template === "gold" ? "#eab308" : "#4f46e5";
    const glassBg = template === "light" ? "rgba(255, 255, 255, 0.95)" : "rgba(15, 23, 42, 0.75)";

    if (template !== "light") {
      const glow1 = ctx.createRadialGradient(900, 300, 50, 900, 300, 600);
      glow1.addColorStop(0, accentColor + "20");
      glow1.addColorStop(1, "transparent");
      ctx.fillStyle = glow1;
      ctx.beginPath();
      ctx.arc(900, 300, 600, 0, Math.PI * 2);
      ctx.fill();

      const glow2 = ctx.createRadialGradient(180, 1600, 50, 180, 1600, 600);
      glow2.addColorStop(0, accentColor + "15");
      glow2.addColorStop(1, "transparent");
      ctx.fillStyle = glow2;
      ctx.beginPath();
      ctx.arc(180, 1600, 600, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = template === "light" ? "rgba(79, 70, 229, 0.04)" : "rgba(255, 255, 255, 0.02)";
    ctx.lineWidth = 4;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.arc(540, 960, 300 + i * 150, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(1080 - 180, 180);
    ctx.rotate(Math.PI / 4);
    
    ctx.fillStyle = accentColor;
    ctx.fillRect(-300, -40, 600, 80);
    
    ctx.fillStyle = (template === "obsidian" || template === "light") ? "#ffffff" : "#0f172a";
    ctx.textAlign = "center";
    ctx.font = "black 32px 'Outfit', 'Inter', system-ui, sans-serif";
    ctx.fillText("SPECIAL DISCOUNT", 0, 12);
    ctx.restore();

    ctx.textAlign = "center";
    ctx.fillStyle = accentColor;
    ctx.font = "bold 44px 'Outfit', 'Inter', system-ui, sans-serif";
    ctx.fillText("OFFICIAL DATA RESELLER", 540, 180);

    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = textColor;
    ctx.font = "black 94px 'Outfit', 'Inter', system-ui, sans-serif";
    ctx.fillText((agentProfile.store_name || "MY DATA STORE").toUpperCase(), 540, 290);
    ctx.restore();

    ctx.fillStyle = subColor;
    ctx.font = "italic 40px 'Outfit', 'Inter', system-ui, sans-serif";
    ctx.fillText(tagline || "Fast & Affordable Data Bundles", 540, 360);

    const cardX = 100;
    const cardY = 460;
    const cardW = 880;
    const cardH = 920;
    const radius = 50;

    ctx.fillStyle = glassBg;
    const borderGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
    borderGrad.addColorStop(0, "rgba(255, 255, 255, 0.2)");
    borderGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.05)");
    borderGrad.addColorStop(1, accentColor + "33");
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(cardX + radius, cardY);
    ctx.lineTo(cardX + cardW - radius, cardY);
    ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + radius);
    ctx.lineTo(cardX + cardW, cardY + cardH - radius);
    ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - radius, cardY + cardH);
    ctx.lineTo(cardX + radius, cardY + cardH);
    ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - radius);
    ctx.lineTo(cardX, cardY + radius);
    ctx.quadraticCurveTo(cardX, cardY, cardX + radius, cardY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = template === "light" ? "rgba(79, 70, 229, 0.06)" : "rgba(255, 255, 255, 0.03)";
    ctx.strokeStyle = accentColor + "30";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(540 - 320, 500, 640, 80, 40);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = accentColor;
    ctx.font = "black 36px 'Outfit', 'Inter', system-ui, sans-serif";
    ctx.fillText("TODAY'S COMPETITIVE RATES", 540, 552);

    const startY = 690;
    const rowGap = 160;

    const getNetworkStyle = (netCode: string) => {
      const code = (netCode || "").toLowerCase();
      if (code.includes("mtn")) return { bg: "rgba(234, 179, 8, 0.15)", text: "#eab308", border: "rgba(234, 179, 8, 0.3)" };
      if (code.includes("telecel") || code.includes("voda")) return { bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444", border: "rgba(239, 68, 68, 0.3)" };
      if (code.includes("airtel") || code.includes("tigo") || code.includes("at")) return { bg: "rgba(59, 130, 246, 0.15)", text: "#3b82f6", border: "rgba(59, 130, 246, 0.3)" };
      return { bg: "rgba(124, 58, 237, 0.15)", text: "#7c3aed", border: "rgba(124, 58, 237, 0.3)" };
    };

    featuredBundles.forEach((b: any, index: number) => {
      if (index >= 4) return;
      const y = startY + index * rowGap;

      ctx.fillStyle = template === "light" ? "rgba(0, 0, 0, 0.015)" : "rgba(255, 255, 255, 0.015)";
      ctx.beginPath();
      ctx.roundRect(cardX + 40, y - 60, cardW - 80, 120, 24);
      ctx.fill();

      const logo = b.network?.logo_emoji || "📶";
      const netStyle = getNetworkStyle(b.network?.code);
      ctx.fillStyle = netStyle.bg;
      ctx.strokeStyle = netStyle.border;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(cardX + 60, y - 40, 240, 80, 40);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.fillStyle = template === "light" ? netStyle.text : "#ffffff";
      ctx.font = "bold 32px 'Outfit', 'Inter', system-ui, sans-serif";
      ctx.fillText(`${logo} ${b.network?.name || "Network"}`, cardX + 180, y + 12);

      ctx.textAlign = "left";
      ctx.fillStyle = textColor;
      ctx.font = "extrabold 42px 'Outfit', 'Inter', system-ui, sans-serif";
      ctx.fillText(b.size_label, cardX + 330, y + 15);

      ctx.textAlign = "right";
      const mockRegularPrice = Math.ceil(b.sellPrice * 1.25);
      ctx.fillStyle = "rgba(148, 163, 184, 0.55)";
      ctx.font = "500 30px 'Outfit', 'Inter', system-ui, sans-serif";
      const regularText = `GH₵ ${mockRegularPrice.toFixed(2)}`;
      
      const priceText = `GH₵ ${b.sellPrice.toFixed(2)}`;
      ctx.font = "black 52px 'Outfit', 'Inter', system-ui, sans-serif";
      const priceWidth = ctx.measureText(priceText).width;

      ctx.fillStyle = "rgba(148, 163, 184, 0.55)";
      ctx.font = "500 30px 'Outfit', 'Inter', system-ui, sans-serif";
      ctx.fillText(regularText, cardX + cardW - 70 - priceWidth - 25, y + 10);
      
      const regularWidth = ctx.measureText(regularText).width;
      ctx.strokeStyle = "rgba(239, 68, 68, 0.65)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cardX + cardW - 70 - priceWidth - 25 - regularWidth, y);
      ctx.lineTo(cardX + cardW - 70 - priceWidth - 25, y);
      ctx.stroke();

      ctx.fillStyle = accentColor;
      ctx.font = "black 52px 'Outfit', 'Inter', system-ui, sans-serif";
      ctx.fillText(priceText, cardX + cardW - 70, y + 15);
    });

    ctx.fillStyle = glassBg;
    ctx.strokeStyle = borderGrad;
    ctx.beginPath();
    ctx.moveTo(cardX + radius, 1440);
    ctx.lineTo(cardX + cardW - radius, 1440);
    ctx.quadraticCurveTo(cardX + cardW, 1440, cardX + cardW, 1440 + radius);
    ctx.lineTo(cardX + cardW, 1820 - radius);
    ctx.quadraticCurveTo(cardX + cardW, 1820, cardX + cardW - radius, 1820);
    ctx.lineTo(cardX + radius, 1820);
    ctx.quadraticCurveTo(cardX, 1820, cardX, 1820 - radius);
    ctx.lineTo(cardX, 1440 + radius);
    ctx.quadraticCurveTo(cardX, 1440, cardX + radius, 1440);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = textColor;
    ctx.font = "extrabold 48px 'Outfit', 'Inter', system-ui, sans-serif";
    ctx.fillText("SCAN TO ORDER INSTANTLY", cardX + 60, 1540);

    ctx.fillStyle = subColor;
    ctx.font = "500 36px 'Outfit', 'Inter', system-ui, sans-serif";
    ctx.fillText("Instant Delivery • No Signup Required", cardX + 60, 1610);

    ctx.fillStyle = accentColor + "12";
    ctx.strokeStyle = accentColor + "35";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cardX + 60, 1655, 450, 80, 20);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = accentColor;
    ctx.font = "bold 34px monospace";
    ctx.fillText(storeUrl.replace(/^https?:\/\//, ""), cardX + 285, 1708);

    if (qrImage) {
      ctx.drawImage(qrImage, cardX + cardW - 320, 1485, 260, 260);
    } else {
      ctx.fillStyle = "rgba(0,0,0,0.1)";
      ctx.fillRect(cardX + cardW - 320, 1485, 260, 260);
      ctx.fillStyle = textColor;
      ctx.textAlign = "center";
      ctx.font = "bold 24px 'Outfit', 'Inter', system-ui, sans-serif";
      ctx.fillText("Loading QR...", cardX + cardW - 190, 1620);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    try {
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${agentProfile.store_slug}_promo_poster.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast({ title: "Social Flyer downloaded successfully!" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Export failed", description: "Your browser security settings prevented canvas export.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-3xl border border-border/60 bg-card p-5 md:p-6 shadow-soft">
            <h2 className="text-base font-bold text-foreground">Marketing Kit Customizer</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Design beautiful WhatsApp status posters and promotional flyers showcasing your cheap data rates.</p>

            <div className="mt-6 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground uppercase tracking-widest">1. Select Poster Aesthetic</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "obsidian", label: "Obsidian Midnight", color: "bg-slate-900 border-slate-700" },
                    { id: "neon", label: "Glassmorphism Neon", color: "bg-emerald-950 border-emerald-500/30" },
                    { id: "gold", label: "Gold Champion", color: "bg-stone-900 border-yellow-500/30" },
                    { id: "light", label: "Minimalist Light", color: "bg-slate-50 border-slate-200" },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTemplate(t.id as any)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                        template === t.id ? "ring-2 ring-primary border-primary scale-[1.02]" : "hover:bg-secondary/40"
                      }`}
                    >
                      <span className={`w-8 h-8 rounded-full mb-1.5 border ${t.color}`} />
                      <span className="text-[10px] font-bold">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground uppercase tracking-widest">2. Tagline Message</label>
                <Input
                  value={tagline}
                  onChange={e => setTagline(e.target.value)}
                  placeholder="Fast & Affordable Data Bundles"
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground uppercase tracking-widest flex items-center justify-between">
                  <span>3. Featured Bundles (Choose Up To 4)</span>
                  <span className="text-[10px] text-muted-foreground normal-case font-medium">Selected: {selectedBundles.length} / 4</span>
                </label>

                {isLoading ? (
                  <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="max-h-60 overflow-y-auto border border-border/60 rounded-xl divide-y divide-border/40 p-1 bg-secondary/15">
                    {(payload?.bundles ?? []).map((b: any) => {
                      const selected = selectedBundles.includes(b.id);
                      return (
                        <button
                          key={b.id}
                          onClick={() => {
                            if (selected) {
                              setSelectedBundles(p => p.filter(id => id !== b.id));
                            } else {
                              if (selectedBundles.length >= 4) {
                                toast({ title: "Limit reached", description: "You can feature a maximum of 4 bundles.", variant: "destructive" });
                                return;
                              }
                              setSelectedBundles(p => [...p, b.id]);
                            }
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-lg text-left text-xs transition-all ${
                            selected ? "bg-primary/10 text-primary font-bold" : "hover:bg-secondary/40 text-muted-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm shrink-0">{b.network?.logo_emoji}</span>
                            <span>{b.network?.name} {b.size_label}</span>
                          </div>
                          <span className="font-bold text-foreground">GH₵{b.sellPrice.toFixed(2)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <Button
                onClick={handleDownload}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-lg"
              >
                Download Poster (PNG)
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-4 bg-secondary/10 border border-border/60 rounded-3xl min-h-[500px]">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Live Status Preview</p>
          <div className="relative w-[270px] h-[480px] rounded-2xl overflow-hidden shadow-2xl border border-border/80">
            <canvas
              ref={canvasRef}
              width={1080}
              height={1920}
              className="w-full h-full bg-card"
            />
          </div>
        </div>
      </div>

      {/* ── BROADCASTER COMMAND CENTER ── */}
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
        <div className="border-b border-border/60 bg-primary/5 px-5 py-4 md:px-6">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Megaphone className="h-4.5 w-4.5 text-rose-500 animate-pulse" /> Live Storefront Broadcaster
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Send real-time alerts and promotional push notifications instantly to all registered storefront buyers.</p>
        </div>

        <div className="p-5 md:p-6 bg-card text-foreground">
          <form onSubmit={handleBroadcast} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Broadcast Title</label>
                <Input
                  placeholder="e.g. ✨ Weekend Data Rush!"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="h-11 rounded-xl focus:ring-primary text-foreground"
                  required
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Notification Message</label>
                <textarea
                  placeholder="Write your announcement or discount notification here..."
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="w-full min-h-[100px] rounded-2xl border border-border bg-transparent px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none text-foreground"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Notification Type</label>
                <select
                  value={broadcastType}
                  onChange={(e) => setBroadcastType(e.target.value)}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="info">Info Announcement (Blue)</option>
                  <option value="success">Success Chime (Green)</option>
                  <option value="warning">Attention Alert (Amber)</option>
                  <option value="error">Critical Notification (Red)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Audio Notification Chime</label>
                <select
                  value={broadcastSound}
                  onChange={(e) => setBroadcastSound(e.target.value)}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="default">Pop (Default)</option>
                  <option value="success">Chime (Success)</option>
                  <option value="paystack">Coin Drop (Earning)</option>
                  <option value="alert">Siren (Alert)</option>
                </select>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isBroadcasting || !broadcastTitle.trim() || !broadcastMessage.trim()}
              className="mt-2 h-11 px-8 rounded-xl font-bold bg-primary text-primary-foreground shadow-float flex items-center justify-center gap-2"
            >
              {isBroadcasting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
              {isBroadcasting ? "Broadcasting Alert..." : "Send Bulk Broadcast Announcement"}
            </Button>
          </form>
        </div>
      </div>

      {/* ── LIVE ORDER PROOF WIDGET ── */}
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
        <div className="border-b border-border/60 bg-primary/5 px-5 py-4 md:px-6">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Activity className="h-4.5 w-4.5 text-indigo-400" /> Live Order Proof Widget
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Build customer trust on your external website or blog by showing live MTN data delivery proofs.</p>
        </div>

        <div className="p-5 md:p-6 bg-card text-foreground space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-foreground">How it Works</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Display real-time successful MTN data deliveries on your external site. It builds trust and increases conversion rates. Simply copy one of the embed codes below.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Method 1: JavaScript Snippet (Recommended)</h4>
                <p className="text-[11px] text-muted-foreground">Add a container div and include our script. The widget renders inline automatically.</p>
                <div className="relative rounded-xl bg-slate-950 p-3 font-mono text-[10px] text-slate-300">
                  <code className="block select-all whitespace-pre-wrap">
                    {`<div id="datahub-mtn-widget"></div>\n<script src="https://user.datahubgh.com/api/widget/last-mtn-delivered?format=script&theme=green"></script>`}
                  </code>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Method 2: Iframe Embed</h4>
                <p className="text-[11px] text-muted-foreground">Use an iframe for complete style isolation from your website's CSS.</p>
                <div className="relative rounded-xl bg-slate-950 p-3 font-mono text-[10px] text-slate-300">
                  <code className="block select-all whitespace-pre-wrap">
                    {`<iframe\n  src="https://user.datahubgh.com/api/widget/last-mtn-delivered?format=html&theme=green"\n  style="width: 100%; height: 60px; border: none;"\n  scrolling="no"\n></iframe>`}
                  </code>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-foreground">Live Widget Preview</h3>
              <div className="rounded-2xl border border-border p-4 bg-secondary/10 flex flex-col gap-3 justify-center min-h-[140px]">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Preview (Green Theme)</p>
                <iframe
                  src="https://user.datahubgh.com/api/widget/last-mtn-delivered?format=html&theme=green"
                  style={{ width: "100%", height: "60px", border: "none" }}
                  scrolling="no"
                />
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2">Preview (Dark Theme)</p>
                <iframe
                  src="https://user.datahubgh.com/api/widget/last-mtn-delivered?format=html&theme=dark"
                  style={{ width: "100%", height: "60px", border: "none" }}
                  scrolling="no"
                />
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Customization parameters</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] text-muted-foreground divide-y divide-border/60">
                    <thead>
                      <tr className="text-foreground font-bold">
                        <th className="pb-1.5 pr-2">Param</th>
                        <th className="pb-1.5 px-2">Options</th>
                        <th className="pb-1.5 px-2">Default</th>
                        <th className="pb-1.5 pl-2">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      <tr>
                        <td className="py-1.5 font-mono pr-2">theme</td>
                        <td className="py-1.5 px-2">green, blue, dark, light</td>
                        <td className="py-1.5 px-2 font-mono">dark</td>
                        <td className="py-1.5 pl-2">Color style aesthetic</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 font-mono pr-2">icon</td>
                        <td className="py-1.5 px-2">true, false</td>
                        <td className="py-1.5 px-2 font-mono">true</td>
                        <td className="py-1.5 pl-2">Toggle lightning bolt icon</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
