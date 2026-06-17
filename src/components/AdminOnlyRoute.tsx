import { Loader2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { AccessDenied } from "@/components/AccessDenied";

export const AdminOnlyRoute = ({ children }: { children: JSX.Element }) => {
  // useUserRole é cacheado (react-query) → após o 1º load não refaz a query nem
  // pisca o loader ao navegar entre as rotas do Sucesso.
  const { isAdmin, loading } = useUserRole();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <AccessDenied
        title="Área restrita"
        message="Esta área está disponível apenas para Admins e Super Admins."
      />
    );
  }
  return children;
};
