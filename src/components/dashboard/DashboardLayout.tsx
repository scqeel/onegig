import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, MessageCircle, Search, Menu, X, ChevronRight, UserCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useUnreadNotifications } from "@/hooks/useNotifications";

type SidebarItem = {
  label: string;
  icon?: ReactNode;
  to?: string;
  active?: boolean;
  onClick?: () => void;
};

export function DashboardLayout({
  title,
  subtitle,
  badge,
  sidebarHeader,
  sidebarItems = [],
  topActions,
  children,
  mainClassName,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  sidebarHeader?: ReactNode;
  sidebarItems?: SidebarItem[];
  topActions?: ReactNode;
  children: ReactNode;
  mainClassName?: string;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { data: unreadCount } = useUnreadNotifications();
  const location = useLocation();
  const nav = useNavigate();
  const { profile } = useAuth();
  const isNotifications = location.pathname === "/dashboard/notifications";

  const [promptOpen, setPromptOpen] = useState(false);
  const [momoName, setMomoName] = useState("");

  useEffect(() => {
    const showPrompt = localStorage.getItem("show_profile_completion_prompt") === "true";
    const name = localStorage.getItem("resolved_profile_name");
    if (showPrompt && name) {
      setMomoName(name);
      setPromptOpen(true);
    }
  }, [profile]);

  const handleReviewProfile = () => {
    localStorage.removeItem("show_profile_completion_prompt");
    localStorage.removeItem("resolved_profile_name");
    setPromptOpen(false);
    nav("/dashboard/profile");
  };

  const handleClosePrompt = () => {
    localStorage.removeItem("show_profile_completion_prompt");
    localStorage.removeItem("resolved_profile_name");
    setPromptOpen(false);
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1540px] px-3 py-4 pb-28 md:px-6 md:py-5 lg:pb-5 xl:px-8">

        {/* ── Top bar ── */}
        <div className="mb-4 md:mb-5 flex flex-col gap-3 md:gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground md:text-3xl">{title}</h1>
              {subtitle && <p className="mt-0.5 md:mt-1 text-xs md:text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            
            {/* Top mobile menu button removed in favor of bottom nav */}
          </div>

          <div className="flex w-full items-center gap-2 xl:w-auto">
            <label className="relative hidden w-full xl:block xl:w-[340px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search…"
                className="h-10 w-full rounded-xl border border-border/50 bg-secondary/40 pl-10 pr-3 text-sm text-foreground outline-none backdrop-blur-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30 transition-all"
              />
            </label>
            <button type="button" aria-label="Messages" className="hidden h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-card/70 text-muted-foreground transition-colors hover:text-foreground xl:inline-flex">
              <MessageCircle className="h-4 w-4" />
            </button>
            <Link 
              to="/dashboard/notifications" 
              aria-label="Notifications" 
              className={cn(
                "relative hidden h-10 w-10 items-center justify-center rounded-xl border border-border/60 transition-colors xl:inline-flex",
                isNotifications ? "bg-primary/10 text-primary" : "bg-card/70 text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
              )}
            >
              <Bell className="h-4 w-4" fill={isNotifications ? "currentColor" : "none"} />
              {!!unreadCount && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-card animate-in zoom-in">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
            {badge && (
              <span className="rounded-full gradient-primary px-3 py-1 text-xs font-bold text-white shadow-soft">
                {badge}
              </span>
            )}
            {topActions}
          </div>
        </div>

        {/* ── Grid ── */}
        <div className="grid gap-4 lg:grid-cols-12 xl:gap-5">

          {/* ── Sidebar ── */}
          <aside className="hidden self-start rounded-3xl border border-border/50 bg-card/90 shadow-float backdrop-blur-md lg:block lg:sticky lg:top-5 lg:col-span-3 xl:col-span-2">
            {sidebarHeader && (
              <div className="border-b border-border/60 px-3 py-3">
                {sidebarHeader}
              </div>
            )}

              <nav className="p-2 space-y-0.5 relative z-10">
                {sidebarItems?.map((item) => {
                  const itemCls = cn(
                    "flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all w-full text-left",
                    item.active
                      ? "gradient-primary text-primary-foreground shadow-soft"
                      : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground bg-transparent"
                  );

                  if (item.to) {
                    return (
                      <Link key={item.label} to={item.to} className={itemCls}>
                        {item.icon}
                        <span className="whitespace-nowrap">{item.label}</span>
                      </Link>
                    );
                  }

                  return (
                    <button key={item.label} type="button" onClick={item.onClick} className={itemCls}>
                      {item.icon}
                      <span className="whitespace-nowrap">{item.label}</span>
                    </button>
                  );
                })}
              </nav>

            {/* Sidebar status card */}
            <div className="m-2 mt-1 hidden overflow-hidden rounded-2xl bg-[#05080f] p-3.5 lg:block">
              <div className="absolute inset-0 grid-pattern-dark opacity-30 pointer-events-none" />
              <div className="relative flex items-center gap-2 mb-2">
                <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                <p className="text-xs font-bold text-white">System Online</p>
              </div>
              <p className="relative text-[10px] text-white/35 leading-relaxed">Instant delivery active. All networks operational.</p>
            </div>
          </aside>

          {/* ── Main content ── */}
          <main className={cn("min-w-0 lg:col-span-9 xl:col-span-10", mainClassName)}>
            {children}
          </main>
        </div>
      </div>

      {/* ── Mobile Bottom Navigation (Modern Floating Pill) ── */}
      {sidebarItems.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 lg:hidden pointer-events-none">
          <div className="mx-auto flex h-16 max-w-md items-center justify-between rounded-full border border-slate-200/50 bg-[#0b0f19]/95 px-4 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-xl pointer-events-auto">
            {sidebarItems.slice(0, 4).map((item) => {
              const isActive = item.active;
              const content = (
                <div className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-all duration-300 w-full h-full",
                  isActive ? "text-primary font-bold" : "text-white/40 hover:text-white/80"
                )}>
                  {isActive && (
                    <span className="absolute -top-[18px] h-1 w-8 rounded-full bg-primary shadow-[0_0_12px_rgba(139,92,246,0.9)] animate-in fade-in zoom-in" />
                  )}
                  <span className="transition-transform duration-300">
                    {item.icon}
                  </span>
                  <span className="text-[10px] font-bold tracking-tight">
                    {item.label}
                  </span>
                </div>
              );

              if (item.to) {
                return (
                  <Link key={item.label} to={item.to} className="flex-1 flex justify-center h-full items-center active:scale-95 transition-transform touch-manipulation">
                    {content}
                  </Link>
                );
              }
              return (
                <button key={item.label} type="button" onClick={item.onClick} className="flex-1 flex justify-center h-full items-center active:scale-95 transition-transform touch-manipulation">
                  {content}
                </button>
              );
            })}

            {/* More Button */}
            {sidebarItems.length > 4 && (
              <button 
                type="button" 
                onClick={(e) => {
                  e.currentTarget.blur();
                  setIsMobileMenuOpen(true);
                }}
                className="flex-1 flex justify-center h-full items-center active:scale-95 transition-transform touch-manipulation"
              >
                <div className="relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-all duration-300 text-white/40 hover:text-white/80">
                  <span className="transition-transform duration-300">
                    <Menu className="h-5 w-5" />
                  </span>
                  <span className="text-[10px] font-bold tracking-tight">
                    More
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Mobile Navigation Drawer (Modern) ── */}
      <Drawer open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <DrawerContent className="bg-background border-border/40 rounded-t-[32px] max-h-[85vh]">
          <DrawerHeader className="border-b border-border/40 pb-4 pt-6 px-6">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center shadow-soft">
                <span className="text-xs font-black text-white">OG</span>
              </div>
              <DrawerTitle className="text-left text-xl font-black tracking-tight text-foreground">Navigation</DrawerTitle>
            </div>
            <DrawerDescription className="sr-only">Main navigation menu</DrawerDescription>
          </DrawerHeader>
          
          <div className="overflow-y-auto p-5 pb-12 space-y-6">
            {sidebarHeader && (
              <div className="rounded-3xl border border-border/50 bg-card/40 p-4 shadow-sm">
                {sidebarHeader}
              </div>
            )}
            
            <div className="overflow-hidden rounded-[20px] border border-border/50 bg-secondary/20 shadow-sm">
              {sidebarItems?.map((item, idx) => {
                const isLast = idx === sidebarItems.length - 1;
                const itemCls = cn(
                  "flex items-center justify-between px-5 py-4 w-full text-left transition-colors active:bg-secondary/40",
                  !isLast && "border-b border-border/50",
                  item.active ? "bg-primary/5" : "hover:bg-secondary/30"
                );

                const content = (
                  <>
                    <div className="flex items-center gap-3.5">
                      <div className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-xl",
                        item.active ? "bg-primary text-primary-foreground shadow-soft" : "bg-card border border-border/60 text-muted-foreground"
                      )}>
                        {item.icon}
                      </div>
                      <span className={cn(
                        "text-[15px] font-semibold tracking-tight",
                        item.active ? "text-primary" : "text-foreground"
                      )}>
                        {item.label}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                  </>
                );

                if (item.to) {
                  return (
                    <Link 
                      key={item.label} 
                      to={item.to} 
                      className={itemCls}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <button 
                    key={item.label} 
                    type="button" 
                    onClick={() => {
                      if (item.onClick) item.onClick();
                      setIsMobileMenuOpen(false);
                    }} 
                    className={itemCls}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <Dialog open={promptOpen} onOpenChange={(val) => !val && handleClosePrompt()}>
        <DialogContent className="w-[94vw] max-w-sm rounded-[2rem] border border-slate-200/50 dark:border-slate-800/50 p-6 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-float animate-in fade-in zoom-in duration-300">
          <DialogHeader className="space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 shadow-sm animate-bounce">
              <UserCheck className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center text-lg font-black text-foreground">
              Profile Auto-Completed! 🚀
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground/80 leading-relaxed">
              We resolved your registered MoMo name: <span className="font-bold text-foreground font-mono block mt-1.5 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/30">{momoName}</span> and updated your profile display name automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 pt-3">
            <Button
              onClick={handleReviewProfile}
              className="w-full h-11 rounded-xl font-bold bg-primary hover:bg-primary/95 text-primary-foreground transition-all hover:scale-[1.02] active:scale-[0.98] text-xs shadow-soft"
            >
              Verify & Complete Profile
            </Button>
            <Button
              variant="ghost"
              onClick={handleClosePrompt}
              className="w-full h-10 rounded-xl font-bold text-xs hover:bg-secondary/50 text-muted-foreground"
            >
              Looks good!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
