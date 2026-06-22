import { useQuery } from "@tanstack/react-query";
import { loadRankingExcluidos } from "@/lib/rankingExclusao";

const EMPTY: string[] = [];

/** Lista de agentes removidos dos rankings de Ativadores (cacheada via react-query). */
export const useRankingExcluidos = () => {
  const { data } = useQuery({
    queryKey: ["ranking-excluidos"],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: loadRankingExcluidos,
  });
  return { excluidos: data ?? EMPTY };
};
