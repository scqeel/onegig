import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bell, MessageCircle, Search } from "lucide-react";
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
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1540px] px-3 py-4 md:px-6 md:py-5 xl:px-8">

        {/* ── Top bar ── */}
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
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
          <aside className="self-start rounded-3xl border border-border/50 bg-card/90 shadow-float backdrop-blur-md lg:sticky lg:top-5 lg:col-span-3 xl:col-span-2">
            {sidebarHeader && (
              <div className="border-b border-border/60 px-3 py-3">
                {sidebarHeader}
              </div>
            )}

            <nav className="flex gap-1 overflow-x-auto p-2 no-scrollbar lg:block lg:space-y-0.5">
              {sidebarItems?.map((item) => {
                const itemCls = cn(
                  "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all lg:w-full",
                  item.active
                    ? "gradient-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                );

                if (item.to) {
                  return (
                    <Link key={item.label} to={item.to} className={itemCls}>
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  );
                }

                return (
                  <button key={item.label} type="button" onClick={item.onClick} className={itemCls}>
                    {item.icon}
                    <span>{item.label}</span>
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
    </AppShell>
  );
}
