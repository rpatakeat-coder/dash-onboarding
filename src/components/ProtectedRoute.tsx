import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";

interface Props {
  children: JSX.Element;
  /** When true, viewer users are allowed on this route. Defaults to false (redirected to "/"). */
  viewerAllowed?: boolean;
}

export const ProtectedRoute = ({ children, viewerAllowed = false }: Props) => {
  const { session, loading } = useAuth();
  const { isViewer, role, homeRoute, loading: roleLoading } = useUserRole();
  const location = useLocation();

  // Only show the full-screen loader on the INITIAL load (no session/role known yet).
  // Once resolved, navigating between routes must not re-trigger this state.
  if (loading || (roleLoading && role === null && !!session)) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (isViewer && !viewerAllowed) {
    if (location.pathname === "/") {
      return children;
    }
    // Redireciona para a rota inicial do usuário (depende do Time): onboarding → "/", só-sucesso → "/sucesso".
    return <Navigate to={homeRoute} replace />;
  }

  return children;
};
