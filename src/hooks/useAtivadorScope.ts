import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import type { DashRow } from "@/hooks/useDashOperacoes";

/**
 * Access scope for the current user:
 *  - admin: sees everything
 *  - ativador (any non-admin): sees aggregated/general data, but
 *    detail tables / personal lists are restricted to their own deals
 *    (matched by `agente_ativacao` on the profile, falling back to `full_name`).
 */
export const useAtivadorScope = () => {
  const { fullName, agenteAtivacao, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();

  const ready = !authLoading && !roleLoading;
  const myAgente = (agenteAtivacao ?? fullName ?? "").trim();
  const isAtivador = ready && !isAdmin && !!myAgente;

  return {
    ready,
    isAdmin,
    isAtivador,
    myAgente,
    /** Returns rows scoped to the user when ativador; admins get all rows. */
    scopeRows: (rows: DashRow[]) => {
      if (isAdmin || !isAtivador) return rows;
      const me = myAgente.toLowerCase();
      return rows.filter((r) => (r.agente_ativacao?.trim().toLowerCase() ?? "") === me);
    },
  };
};

/** Pure helper for places that already have isAdmin + myAgente. */
export const filterToAgente = (rows: DashRow[], agente: string) => {
  const me = agente.trim().toLowerCase();
  if (!me) return rows;
  return rows.filter((r) => (r.agente_ativacao?.trim().toLowerCase() ?? "") === me);
};
