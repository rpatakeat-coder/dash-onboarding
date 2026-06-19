import { useEffect, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { edgeErrorMessage } from "@/lib/edgeError";
import { useAuth } from "@/hooks/useAuth";

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

const QK = ["copilot_messages"] as const;

export function useCopilot() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const qc = useQueryClient();

  const historyQuery = useQuery({
    queryKey: QK,
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<CopilotMessage[]> => {
      const { data, error } = await supabase
        .from("copilot_messages")
        .select("id, role, content, created_at")
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []).filter((m): m is CopilotMessage => m.role === "user" || m.role === "assistant");
    },
  });

  const [pending, setPending] = useState<string | null>(null);

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!userId) throw new Error("Não autenticado.");
      const trimmed = message.trim();
      if (!trimmed) throw new Error("Mensagem vazia.");

      // Persiste mensagem do usuário (otimista no servidor)
      const { error: insErr } = await supabase
        .from("copilot_messages")
        .insert({ user_id: userId, role: "user", content: trimmed, parts: [{ type: "text", text: trimmed }] });
      if (insErr) throw insErr;

      // Histórico para enviar (limita a últimas 12 mensagens p/ contexto)
      const prior = (historyQuery.data ?? []).slice(-12).map((m) => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke("copilot-chat", {
        body: { message: trimmed, history: prior },
      });
      if (error || (data as { error?: string })?.error) throw new Error(await edgeErrorMessage(error, data));
      const content: string = (data as { content?: string })?.content ?? "";

      // Persiste resposta
      const { error: aErr } = await supabase
        .from("copilot_messages")
        .insert({ user_id: userId, role: "assistant", content, parts: [{ type: "text", text: content }] });
      if (aErr) throw aErr;

      return content;
    },
    onMutate: (msg) => setPending(msg.trim()),
    onSettled: async () => {
      setPending(null);
      await qc.invalidateQueries({ queryKey: QK });
    },
  });

  const clear = useCallback(async () => {
    if (!userId) return;
    await supabase.from("copilot_messages").delete().eq("user_id", userId);
    await qc.invalidateQueries({ queryKey: QK });
  }, [userId, qc]);

  return {
    messages: historyQuery.data ?? [],
    isLoading: historyQuery.isLoading,
    isSending: sendMutation.isPending,
    pending,
    error: sendMutation.error as Error | null,
    send: (m: string) => sendMutation.mutateAsync(m),
    clear,
  };
}
