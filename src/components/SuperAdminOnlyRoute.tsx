import { Loader2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { AccessDenied } from "@/components/AccessDenied";

/**
 * Gate de rota só para Super Admins (role = "super_admin"). Mais restrito que o AdminOnlyRoute
 * (que também libera "admin"). Usado na aba Inatividade enquanto ela está em rollout.
 */
export const SuperAdminOnlyRoute = ({ children }: { children: JSX.Element }) => {
  const { isSuperAdmin, loading } = useUserRole();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isSuperAdmin) {
    return (
      <AccessDenied
        title="Área restrita"
        message="Esta área está disponível apenas para Super Admins."
      />
    );
  }
  return children;
};
