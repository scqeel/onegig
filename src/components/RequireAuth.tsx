import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, AppRole } from "@/contexts/AuthContext";

export function RequireAuth({ children, role }: { children: ReactNode; role?: AppRole }) {
  const { session, loading, roles } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" state={{ from: loc.pathname }} replace />;
  
  // Enforce phone verification
  const hasVerifiedPhone = session.user.phone && session.user.phone_confirmed_at;
  if (!hasVerifiedPhone) {
    return <Navigate to="/verify-phone" state={{ from: loc.pathname }} replace />;
  }

  if (role && !roles.includes(role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}