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
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#080c1a] px-6 text-center">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />

      <div className="relative">
        {/* Big 404 */}
        <p className="text-[120px] font-bold leading-none gradient-text opacity-80 md:text-[180px]">404</p>

        <h1 className="mt-2 text-2xl font-bold text-white md:text-3xl">Page not found</h1>
        <p className="mt-3 max-w-sm text-sm text-white/45">
          The page you're looking for doesn't exist or may have been moved.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button
            asChild
            className="h-12 rounded-xl px-8 font-bold bg-white text-primary hover:bg-white/95 shadow-[0_8px_32px_hsl(271_91%_52%/0.3)]"
          >
            <Link to="/">
              <Home className="mr-2 h-4 w-4" /> Back to Home
            </Link>
          </Button>
          <Button
            asChild
            className="h-12 rounded-xl px-8 font-semibold border border-white/15 text-white/70 bg-white/5 hover:bg-white/10 hover:text-white"
          >
            <Link to="/buy">Buy Data</Link>
          </Button>
        </div>

        <p className="mt-10 text-xs text-white/20">
          If you think this is a mistake,{" "}
          <a href="mailto:support@datahustle.shop" className="underline hover:text-white/50 transition-colors">
            contact support
          </a>
        </p>
      </div>
    </div>
  );
};

export default NotFound;
