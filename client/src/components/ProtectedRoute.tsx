import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      const redirect = encodeURIComponent(location);
      setLocation(`/login?redirect=${redirect}`, { replace: true });
      return;
    }

    if (adminOnly && user.role !== "admin") {
      setLocation("/dashboard", { replace: true });
    }
  }, [loading, user, location, setLocation, adminOnly]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return null;
  if (adminOnly && user.role !== "admin") return null;

  return <>{children}</>;
}
