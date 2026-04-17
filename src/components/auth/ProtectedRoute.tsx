import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface Props {
  children: React.ReactNode;
  /** If provided, only users with this role (or admin) can view. Others are redirected to their own dashboard. */
  requiredRole?: AppRole;
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { session, role, loading } = useAuth();
  const location = useLocation();

  // 1. Loading — show spinner, never blank
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Checking your session…</p>
      </div>
    );
  }

  // 2. Not logged in → /login
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // 3. Role mismatch — redirect to their own dashboard (never show blank)
  if (requiredRole && role && role !== requiredRole && role !== "admin") {
    const target = role === "doctor" ? "/doctor-dashboard" : "/patient-dashboard";
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}
