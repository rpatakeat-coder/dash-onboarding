import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

// Lista de pessoas (agente_ativacao) que o admin removeu dos rankings de Ativadores
// (Variável + Metas/Medalhas). Guardada em app_settings.key = 'ranking.excluidos',
// value = { agentes: string[] }. Leitura por qualquer autenticado; escrita só admin (RLS).

export const RANKING_EXCLUIDOS_KEY = "ranking.excluidos" as const;

export const normAgente = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export const loadRankingExcluidos = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", RANKING_EXCLUIDOS_KEY)
    .maybeSingle();
  if (error) throw error;
  const v = (data?.value ?? {}) as { agentes?: unknown };
  const arr = Array.isArray(v.agentes) ? v.agentes : [];
  return arr.filter((x): x is string => typeof x === "string" && x.trim() !== "");
};

export const saveRankingExcluidos = async (agentes: string[], updatedBy: string | null): Promise<void> => {
  const { error } = await supabase.from("app_settings").upsert(
    { key: RANKING_EXCLUIDOS_KEY, value: { agentes } as unknown as Json, updated_by: updatedBy },
    { onConflict: "key" },
  );
  if (error) throw error;
};
