import { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  BriefcaseBusiness, GraduationCap, Home, LogOut, Search, Send, ShieldCheck, Smartphone, Tv, User, Zap,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";

export type PublicPage = "home" | "data" | "airtime" | "bill" | "checker" | "track" | "verify" | "submit";

const ICON = "h-4 w-4";

/** Puts customer-facing pages on the same sidebar and phone bar as the admin console. */
export function PublicLayout({
  active,
  title,
  subtitle,
  topActions,
  children,
}: {
  active?: PublicPage;
  title: string;
  subtitle?: string;
  topActions?: ReactNode;
  children: ReactNode;
}) {
  const { user, isAdmin, isAgent, signOut } = useAuth();
  const dashboardPath = isAdmin ? "/admin" : isAgent ? "/agent" : "/dashboard/customer";
  const dashboardLabel = isAdmin ? "Admin Dashboard" : isAgent ? "Agent Dashboard" : "My Dashboard";

  const page = (
    value: PublicPage,
    label: string,
    to: string,
    icon: ReactNode,
    mobile?: { shortLabel: string; mobilePriority: number },
  ) => ({ label, to, icon, active: active === value, ...mobile });

  const logo = (
    <Link to="/" aria-label="OneGig home">
      <Logo size="sm" />
    </Link>
  );

  return (
    <DashboardLayout
      title={title}
      subtitle={subtitle}
      tools="none"
      brand={logo}
      sidebarHeader={logo}
      topActions={topActions}
      sidebarItems={[
        page("home", "Home", "/", <Home className={ICON} />, { shortLabel: "Home", mobilePriority: 1 }),
        page("data", "Buy Data", "/buy?tab=data", <Zap className={ICON} />, { shortLabel: "Data", mobilePriority: 2 }),
        page("airtime", "Buy Airtime", "/buy?tab=airtime", <Smartphone className={ICON} />, { shortLabel: "Airtime", mobilePriority: 3 }),
        page("bill", "Pay Bills", "/buy?tab=bill", <Tv className={ICON} />),
        page("checker", "Result Checkers", "/buy?tab=checker", <GraduationCap className={ICON} />),
        page("track", "Track Order", "/track", <Search className={ICON} />, { shortLabel: "Track", mobilePriority: 4 }),
        page("verify", "Verify Number", "/verify-number", <ShieldCheck className={ICON} />),
        page("submit", "Submit Numbers", "/submit-numbers", <Send className={ICON} />),
        ...(user
          ? [
              { label: dashboardLabel, to: dashboardPath, icon: <BriefcaseBusiness className={ICON} /> },
              { label: "Log Out", onClick: signOut, icon: <LogOut className={ICON} /> },
            ]
          : [{ label: "Agent Sign In", to: "/auth?tab=signin", icon: <User className={ICON} /> }]),
      ]}
    >
      <div className="space-y-4 xl:space-y-5">
        {children}

        <footer className="flex flex-col items-center justify-between gap-3 border-t border-border pt-5 text-xs text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} OneGig Ghana. All rights reserved.</p>
          <div className="flex flex-wrap justify-center gap-4 font-semibold">
            <a href="mailto:support@onegig.shop" className="hover:text-foreground">support@onegig.shop</a>
            <Link to="/auth?intent=agent" className="hover:text-foreground">Become an Agent</Link>
          </div>
        </footer>
      </div>
    </DashboardLayout>
  );
}
