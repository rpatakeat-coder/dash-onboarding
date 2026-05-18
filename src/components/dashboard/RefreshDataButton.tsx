import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { markUserRefresh } from "@/lib/lastUpdated";

const WEBHOOK_URL = "https://webhook.takeat.cloud/webhook/dash-onboarding";

export const RefreshDataButton = () => {
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const handle = async () => {
    setLoading(true);
    try {
      await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "atualizar_dados" }),
      });
      markUserRefresh();
      toast({
        title: "Atualizando dados",
        description: "Buscando os dados mais recentes. Em instantes eles serão carregados.",
      });
      // Refaz as queries do dashboard para puxar o que vier novo
      setTimeout(() => qc.invalidateQueries({ queryKey: ["dash_operacoes"] }), 1500);
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
      className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/[0.06] px-3 py-2 font-subtitle text-sm font-medium text-primary transition hover:bg-primary/10 disabled:opacity-60"
    >
      <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
      {loading ? "Atualizando…" : "Atualizar dados"}
    </button>
  );
};
