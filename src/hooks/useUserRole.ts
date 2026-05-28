import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AppRole = "super_admin" | "admin" | "viewer" | "user" | null;

/**
 * Resolves the current user's operations role.
 *  - super_admin / admin → privileged (isAdmin = true)
 *  - viewer             → read-only access to ranking screens
 *  - user               → ativador (own scope)
 */
export const useUserRole = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("user_roles_operations")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setRole(((data?.role as AppRole) ?? null));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isAdmin = role === "admin" || role === "super_admin";
  const isViewer = role === "viewer";
  return { role, isAdmin, isViewer, loading };
};
