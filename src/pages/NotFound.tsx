import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, BriefcaseBusiness, GraduationCap, HelpCircle, Home, Search, Tv, Zap } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";

const DESTINATIONS = [
  { label: "Home Page", to: "/", icon: Home },
  { label: "Buy Mobile Data", to: "/buy?tab=data", icon: Zap },
  { label: "Track My Order", to: "/track", icon: Search },
  { label: "WAEC Checkers", to: "/buy?tab=checker", icon: GraduationCap },
  { label: "Pay Bills", to: "/buy?tab=bill", icon: Tv },
  { label: "Become Agent", to: "/auth?intent=agent", icon: BriefcaseBusiness },
];

export default function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <PublicLayout
      title="Page not found"
      subtitle="The link you followed might be broken, or the page has been moved."
      topActions={
        <Button onClick={() => navigate(-1)} variant="outline" className="rounded-xl text-xs font-semibold">
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Go Back
        </Button>
      }
    >
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft md:p-6">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Error 404</p>
        <p className="mt-1 break-all font-mono text-sm text-foreground">{location.pathname}</p>

        <p className="mt-6 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Popular Destinations</p>
        <div className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-3">
          {DESTINATIONS.map(({ label, to, icon: Icon }) => (
            <Link
              key={label}
              to={to}
              className="flex items-center gap-2.5 rounded-xl border border-border bg-background p-3 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <Button asChild className="h-11 rounded-xl font-semibold">
            <Link to="/"><Home className="mr-2 h-4 w-4" /> Take Me Home</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 rounded-xl font-semibold">
            <a href="mailto:support@onegig.shop"><HelpCircle className="mr-2 h-4 w-4" /> Contact Support</a>
          </Button>
        </div>
      </div>
    </PublicLayout>
  );
}
