import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MedalCounts {
  gold: number;
  silver: number;
  bronze: number;
}

const EMPTY: MedalCounts = { gold: 0, silver: 0, bronze: 0 };

const norm = (s: string | null | undefined) =>
  (s ?? "").trim().toLowerCase();

export function usePodiumMedals() {
  const { data } = useQuery({
    queryKey: ["podium_history", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("podium_history")
        .select("first, second, third");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const getMedalCounts = (ativador: string): MedalCounts => {
    if (!data || !ativador) return EMPTY;
    const target = norm(ativador);
    let gold = 0, silver = 0, bronze = 0;
    for (const row of data) {
      if (norm(row.first) === target) gold++;
      if (norm(row.second) === target) silver++;
      if (norm(row.third) === target) bronze++;
    }
    return { gold, silver, bronze };
  };

  return { getMedalCounts };
}
