import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface Props {
  children: React.ReactNode;
  requiredRole?: "doctor" | "admin" | "patient";
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { session, loading, hasRole } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && !hasRole(requiredRole) && !hasRole("admin")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-sm font-medium">Access Denied</p>
          <p className="text-xs text-muted-foreground mt-1">You don't have the required role: {requiredRole}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
