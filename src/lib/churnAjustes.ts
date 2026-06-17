import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

// Ajustes manuais do Churn líquido (Upsell/Downsell/Reativações), por período (mês/ano).
// Guardados em app_settings.key = 'sucesso.churn.ajustes', value = { "YYYY-MM": { ... } }.
// RLS: leitura por qualquer autenticado; escrita só admin/super_admin (área Sucesso já é admin-only).

export type ChurnAjuste = { upsell: number; downsell: number; reativacoes: number };
export type ChurnAjustesMap = Record<string, ChurnAjuste>;

export const CHURN_AJUSTES_KEY = "sucesso.churn.ajustes" as const;
export const ZERO_AJUSTE: ChurnAjuste = { upsell: 0, downsell: 0, reativacoes: 0 };

// Chave do período no mapa: "YYYY-MM" (month0 = 0-11).
export const periodoKey = (year: number, month0: number) =>
  `${year}-${String(month0 + 1).padStart(2, "0")}`;

const num = (v: unknown): number => {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const normAjuste = (v: unknown): ChurnAjuste => {
  const o = (v ?? {}) as Record<string, unknown>;
  return { upsell: num(o.upsell), downsell: num(o.downsell), reativacoes: num(o.reativacoes) };
};

export const loadChurnAjustes = async (): Promise<ChurnAjustesMap> => {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", CHURN_AJUSTES_KEY)
    .maybeSingle();
  if (error) throw error;
  const raw = (data?.value ?? {}) as Record<string, unknown>;
  const map: ChurnAjustesMap = {};
  for (const k of Object.keys(raw)) map[k] = normAjuste(raw[k]);
  return map;
};

export const saveChurnAjustes = async (
  map: ChurnAjustesMap,
  updatedBy: string | null,
): Promise<void> => {
  const { error } = await supabase.from("app_settings").upsert(
    { key: CHURN_AJUSTES_KEY, value: map as unknown as Json, updated_by: updatedBy },
    { onConflict: "key" },
  );
  if (error) throw error;
};
