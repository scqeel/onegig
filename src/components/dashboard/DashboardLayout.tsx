import { ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, MessageCircle, Search, Menu, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";

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
            <button type="button" aria-label="Notifications" className="hidden h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-card/70 text-muted-foreground transition-colors hover:text-foreground xl:inline-flex">
              <Bell className="h-4 w-4" />
            </button>
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
          <main className={cn("lg:col-span-9 xl:col-span-10", mainClassName)}>
            {children}
          </main>
        </div>
      </div>

      {/* ── Mobile Bottom Navigation (Modern Floating Pill) ── */}
      {sidebarItems.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 lg:hidden pointer-events-none">
          <div className="mx-auto flex h-16 max-w-md items-center justify-between rounded-full border border-white/10 bg-[#0b0f19]/90 px-4 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-xl pointer-events-auto">
            {sidebarItems.slice(0, 4).map((item) => {
              const isActive = item.active;
              const content = (
                <div className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-1 transition-all duration-300 w-full h-full",
                  isActive ? "text-white" : "text-white/40 hover:text-white/80"
                )}>
                  {isActive && (
                    <span className="absolute -top-[18px] h-1 w-8 rounded-full bg-primary shadow-[0_0_12px_rgba(139,92,246,0.9)] animate-in fade-in zoom-in" />
                  )}
                  <span className={cn("transition-transform duration-300", isActive && "-translate-y-1 text-primary drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]")}>
                    {item.icon}
                  </span>
                  <span className={cn(
                    "text-[10px] font-bold tracking-tight transition-all duration-300",
                    isActive ? "opacity-100 translate-y-0" : "opacity-0 absolute translate-y-4"
                  )}>
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
                onClick={() => setIsMobileMenuOpen(true)}
                className="flex-1 flex justify-center h-full items-center active:scale-95 transition-transform touch-manipulation"
              >
                <div className="relative flex flex-1 flex-col items-center justify-center gap-1 transition-all duration-300 text-white/40 hover:text-white/80">
                  <span className="transition-transform duration-300">
                    <Menu className="h-5 w-5" />
                  </span>
                  <span className="text-[10px] font-bold tracking-tight opacity-0 absolute translate-y-4 transition-all duration-300">
                    More
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Mobile Navigation Overlay ── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-background/95 backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-200 lg:hidden">
          <div className="flex items-center justify-between p-5 border-b border-border/40 bg-card/30">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-primary flex items-center justify-center shadow-soft">
                <span className="text-sm font-black text-white">OG</span>
              </div>
              <span className="text-xl font-bold tracking-tight">Navigation</span>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-card/70 text-muted-foreground transition-all active:scale-95 hover:text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {sidebarHeader && (
              <div className="rounded-3xl border border-border/50 bg-card/40 p-4 shadow-sm">
                {sidebarHeader}
              </div>
            )}
            
            <div className="space-y-2">
              {sidebarItems?.map((item) => {
                const itemCls = cn(
                  "flex items-center gap-4 rounded-2xl px-5 py-4 text-base font-bold transition-all w-full text-left",
                  item.active
                    ? "gradient-primary text-primary-foreground shadow-soft"
                    : "bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
                );

                if (item.to) {
                  return (
                    <Link 
                      key={item.label} 
                      to={item.to} 
                      className={itemCls}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {item.icon}
                      <span>{item.label}</span>
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
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
