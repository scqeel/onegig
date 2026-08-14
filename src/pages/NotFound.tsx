import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="dark relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-6 text-center">
      <div className="relative">
        {/* Big 404 */}
        <p className="text-[120px] font-bold leading-none text-primary opacity-80 md:text-[180px]">404</p>

        <h1 className="mt-2 text-2xl font-bold text-foreground md:text-3xl">Page not found</h1>
        <p className="mt-3 max-w-sm text-sm text-muted-foreground">
          The page you're looking for doesn't exist or may have been moved.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="h-12 rounded-xl px-8">
            <Link to="/">
              <Home className="mr-2 h-4 w-4" /> Back to Home
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-12 rounded-xl px-8">
            <Link to="/buy">Buy Data</Link>
          </Button>
        </div>

        <p className="mt-10 text-xs text-muted-foreground/70">
          If you think this is a mistake,{" "}
          <a href="mailto:support@datahustle.shop" className="underline hover:text-foreground transition-colors">
            contact support
          </a>
        </p>
      </div>
    </div>
  );
};

export default NotFound;
