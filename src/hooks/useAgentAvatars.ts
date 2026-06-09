import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AgentAvatar = {
  avatarUrl: string | null;
  fullName: string | null;
};

const normalize = (s: string | null | undefined) =>
  (s ?? "").trim().toLowerCase();

async function fetchAgentAvatars(): Promise<Map<string, AgentAvatar>> {
  const { data, error } = await supabase
    .from("profiles")
    .select("agente_ativacao, avatar_url, full_name");

  if (error) throw error;

  const map = new Map<string, AgentAvatar>();
  for (const row of data ?? []) {
    const key = normalize(row.agente_ativacao);
    if (!key) continue;
    const existing = map.get(key);
    // Mantém o que tiver avatar_url preenchido
    if (existing && existing.avatarUrl && !row.avatar_url) continue;
    map.set(key, {
      avatarUrl: row.avatar_url ?? null,
      fullName: row.full_name ?? null,
    });
  }
  return map;
}

export function useAgentAvatars() {
  const query = useQuery({
    queryKey: ["agent-avatars"],
    queryFn: fetchAgentAvatars,
    staleTime: 5 * 60 * 1000,
  });

  const getAvatar = useMemo(() => {
    const map = query.data;
    return (ativador: string | null | undefined): AgentAvatar => {
      if (!map) return { avatarUrl: null, fullName: null };
      return (
        map.get(normalize(ativador)) ?? { avatarUrl: null, fullName: null }
      );
    };
  }, [query.data]);

  return { ...query, getAvatar };
}
