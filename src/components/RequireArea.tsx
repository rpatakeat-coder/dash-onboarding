import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import type { AppArea } from "@/contexts/AreaContext";

/**
 * Gate por área (Onboarding/Sucesso) baseado no Time do usuário.
 * Admin/super-admin sempre passam (veem tudo). Quem não tem a área permitida é
 * redirecionado para a sua rota inicial (homeRoute) — evita tela vazia/bloqueada.
 */
export const RequireArea = ({ area, children }: { area: AppArea; children: JSX.Element }) => {
  const { allowedAreas, homeRoute, loading } = useUserRole();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!allowedAreas.has(area)) {
    return <Navigate to={homeRoute} replace />;
  }
  return children;
};
