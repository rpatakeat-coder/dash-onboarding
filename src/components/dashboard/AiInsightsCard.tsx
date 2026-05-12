import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, RefreshCw, Loader2, AlertCircle } from "lucide-react";
import { useAiInsights } from "@/hooks/useAiInsights";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AiInsightsCardProps {
  periodo?: string;
  kpis: Record<string, string | number>;
  operadores: Array<{
    nome: string;
    ativos?: number;
    criticos?: number;
    slaMedio?: number;
    mrr?: number;
  }>;
  snapshotAnterior?: Record<string, string | number>;
  /** Optional stable key fragment, e.g. JSON of active filters. */
  scopeKey?: string;
}

function timeAgo(ts: number) {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora mesmo";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  return `há ${h}h`;
}

export const AiInsightsCard = ({
  periodo,
  kpis,
  operadores,
  snapshotAnterior,
  scopeKey,
}: AiInsightsCardProps) => {
  const cacheKey = useMemo(
    () => `dashboard:${scopeKey ?? "default"}`,
    [scopeKey],
  );
  const { data, isLoading, error, generate, lastGeneratedAt } = useAiInsights<{
    periodo?: string;
    kpis: Record<string, string | number>;
    operadores: AiInsightsCardProps["operadores"];
    snapshotAnterior?: Record<string, string | number>;
  }>("dashboard", cacheKey);

  const onGenerate = (force = false) =>
    generate({ periodo, kpis, operadores, snapshotAnterior }, { force });

  return (
    <section
      className={cn(
        "mb-8 overflow-hidden rounded-2xl border border-border bg-card shadow-sm-soft",
        "relative",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-gradient-to-br from-primary/5 via-card to-card px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-semibold text-foreground">
                Insights da IA
              </h3>
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 font-subtitle text-[10px] font-medium uppercase tracking-wider text-primary">
                OpenAI
              </span>
            </div>
            <p className="font-small text-xs text-muted-foreground">
              Análise automática dos KPIs atuais e ações sugeridas por operador.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastGeneratedAt && (
            <span className="font-small text-xs text-muted-foreground">
              Gerado {timeAgo(lastGeneratedAt)}
              {data?.model ? ` · ${data.model}` : ""}
            </span>
          )}
          <Button
            size="sm"
            variant={data ? "outline" : "default"}
            onClick={() => onGenerate(Boolean(data))}
            disabled={isLoading}
            className="gap-1.5"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : data ? (
              <RefreshCw className="h-3.5 w-3.5" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {isLoading ? "Analisando…" : data ? "Atualizar" : "Gerar análise"}
          </Button>
        </div>
      </div>

      <div className="px-5 py-5">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 font-small text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!data && !isLoading && !error && (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary/60" />
            <p className="font-subtitle text-sm font-medium text-foreground">
              Clique em "Gerar análise" para um resumo executivo da operação
            </p>
            <p className="mt-1 font-small text-xs text-muted-foreground">
              A IA usa apenas os KPIs e operadores filtrados na tela atual.
            </p>
          </div>
        )}

        {isLoading && !data && (
          <div className="space-y-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted/70" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-muted/70" />
            <div className="h-3 w-4/6 animate-pulse rounded bg-muted/70" />
          </div>
        )}

        {data && (
          <div className="prose prose-sm max-w-none text-foreground prose-headings:font-display prose-headings:text-foreground prose-h2:mt-4 prose-h2:text-base prose-h2:font-semibold prose-strong:text-foreground prose-li:my-0.5 prose-ul:my-2">
            <ReactMarkdown>{data.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </section>
  );
};
