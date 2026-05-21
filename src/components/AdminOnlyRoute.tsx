import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { AccessDenied } from "@/components/AccessDenied";

export const AdminOnlyRoute = ({ children }: { children: JSX.Element }) => {
  const { isAdmin, loading } = useIsAdmin();
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
