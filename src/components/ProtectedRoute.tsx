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
  const { isViewer, loading: roleLoading } = useUserRole();
  const location = useLocation();

  if (loading || roleLoading) {
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
    return <Navigate to="/" replace />;
  }

  return children;
};
