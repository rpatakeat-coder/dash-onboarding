import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AppRole = "super_admin" | "admin" | "viewer" | "user" | null;

/**
 * Resolves the current user's operations role.
 *  - super_admin / admin → privileged (isAdmin = true)
 *  - viewer             → read-only access to ranking screens
 *  - user               → ativador (own scope)
 *
 * Cached via react-query so navigating between routes does not refetch
 * and re-trigger the full-screen loader in ProtectedRoute.
 */
export const useUserRole = () => {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["user-role", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async (): Promise<AppRole> => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_roles_operations")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      return ((data?.role as AppRole) ?? null);
    },
  });

  const role: AppRole = (query.data ?? null) as AppRole;
  const loading = !!user && query.isLoading;
  const isAdmin = role === "admin" || role === "super_admin";
  const isViewer = role === "viewer";

  return { role, isAdmin, isViewer, loading };
};
