import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getAllowedAreas, homeRouteForAreas, type AppTeam } from "@/lib/areaAccess";

export type AppRole = "super_admin" | "admin" | "viewer" | "user" | null;

interface RoleRow {
  role: AppRole;
  equipe: AppTeam | null;
}

/**
 * Resolves the current user's operations role + "Time" (equipe).
 *  - super_admin / admin → privileged (isAdmin = true), enxergam todas as áreas
 *  - viewer             → acesso conforme o Time (Onboarding/Sucesso/Gestor)
 *  - user               → ativador (own scope), só Onboarding
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
    queryFn: async (): Promise<RoleRow> => {
      if (!user) return { role: null, equipe: null };
      const { data } = await supabase
        .from("user_roles_operations")
        .select("role, equipe")
        .eq("user_id", user.id)
        .maybeSingle();
      return {
        role: (data?.role as AppRole) ?? null,
        equipe: (data?.equipe as AppTeam | null) ?? null,
      };
    },
  });

  const role: AppRole = query.data?.role ?? null;
  const equipe: AppTeam | null = query.data?.equipe ?? null;
  const loading = !!user && query.isLoading;
  const isAdmin = role === "admin" || role === "super_admin";
  const isViewer = role === "viewer";

  const allowedAreas = getAllowedAreas(role, equipe);
  const homeRoute = homeRouteForAreas(allowedAreas);

  return { role, equipe, isAdmin, isViewer, allowedAreas, homeRoute, loading };
};
