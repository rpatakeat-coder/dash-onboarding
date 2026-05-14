import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OperatorStat } from "@/hooks/useDashOperacoes";

export interface OperatorRecsContext {
  mediaCarteiraGeral?: number;
  slaMedioGeral?: number;
}

export function useOperatorRecommendations() {
  return useMutation({
    mutationFn: async ({
      operador,
      contexto,
    }: {
      operador: OperatorStat;
      contexto?: OperatorRecsContext;
    }): Promise<string> => {
      const top = [...operador.clientes]
        .sort((a, b) => b.sla - a.sla)
        .slice(0, 5)
        .map((c) => ({
          cliente: c.cliente,
          etapa: c.etapa,
          sla_dias: Math.round(c.sla),
          mrr: Math.round(c.mrr || 0),
        }));

      const { data, error } = await supabase.functions.invoke("operator-recommendations", {
        body: {
          ativador: operador.nome,
          payload: {
            clientes: operador.ativos,
            mrr: Math.round(operador.mrr),
            sla_medio: operador.tempoMedio,
            bands: operador.bands,
            media_carteira_geral: contexto?.mediaCarteiraGeral,
            sla_medio_geral: contexto?.slaMedioGeral,
            top_criticos: top,
          },
        },
      });
      if (error) throw error;
      return (data as { content?: string })?.content ?? "";
    },
  });
}
