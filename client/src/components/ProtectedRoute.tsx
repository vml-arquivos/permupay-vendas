/**
 * ProtectedRoute.tsx
 *
 * ALTERAÇÃO: adminOnly não bloqueia mais por role.
 * Qualquer usuário autenticado tem acesso a todas as rotas.
 * A prop adminOnly é mantida na interface para compatibilidade,
 * mas não produz mais redirecionamento nem ocultação.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean; // mantido para compatibilidade — sem efeito
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const redirect = encodeURIComponent(location);
      setLocation(`/login?redirect=${redirect}`, { replace: true });
    }
  }, [loading, user, location, setLocation]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return null;

  return <>{children}</>;
}
