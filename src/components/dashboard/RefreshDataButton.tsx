import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { markUserRefresh } from "@/lib/lastUpdated";
import { supabase } from "@/integrations/supabase/client";

interface RefreshDataButtonProps {
  /** Valor do campo `event` enviado ao webhook. Default: fluxo do Onboarding. */
  event?: string;
  /** queryKey (raiz) a invalidar após disparar o webhook. */
  invalidateKey?: string;
  className?: string;
}

export const RefreshDataButton = ({
  event = "atualizar_dados",
  invalidateKey = "dash_operacoes",
  className,
}: RefreshDataButtonProps = {}) => {
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const handle = async () => {
    setLoading(true);
    try {
      // Dispara via edge function autenticada (o segredo do webhook fica no servidor).
      const { data, error } = await supabase.functions.invoke("trigger-refresh", {
        body: { event },
      });
      if (error || (data as { error?: string })?.error) {
        throw new Error((data as { error?: string })?.error || error?.message || "falha ao acionar atualização");
      }
      markUserRefresh();
      toast({
        title: "Atualizando dados",
        description: "Buscando os dados mais recentes. Em instantes eles serão carregados.",
      });
      // Refaz as queries do dashboard para puxar o que vier novo
      setTimeout(() => qc.invalidateQueries({ queryKey: [invalidateKey] }), 1500);
    } catch (e) {
      toast({
        title: "Falha ao atualizar",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handle}
      disabled={loading}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/[0.06] px-3 py-2 font-subtitle text-sm font-medium text-primary transition hover:bg-primary/10 disabled:opacity-60",
        className,
      )}
    >
      <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
      {loading ? "Atualizando…" : "Atualizar dados"}
    </button>
  );
};
