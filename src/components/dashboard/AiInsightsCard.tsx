import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Sparkles,
  RefreshCw,
  Loader2,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  Users,
  LineChart,
  FileText,
  Settings2,
} from "lucide-react";
import { useAiInsights } from "@/hooks/useAiInsights";
import { useAiPromptTemplates } from "@/hooks/useAiPromptTemplates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AiPromptSettingsDialog } from "./AiPromptSettingsDialog";
import type { InsightType } from "@/lib/aiPromptTemplates";

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

type InsightType = "executive" | "risks" | "opportunities" | "operators" | "trends";

const INSIGHT_TYPES: Array<{
  id: InsightType;
  label: string;
  icon: typeof Sparkles;
  description: string;
}> = [
  { id: "executive", label: "Executivo", icon: FileText, description: "Resumo + ações por operador" },
  { id: "risks", label: "Riscos", icon: AlertTriangle, description: "Alertas e mitigações" },
  { id: "opportunities", label: "Oportunidades", icon: TrendingUp, description: "Onde acelerar" },
  { id: "operators", label: "Operadores", icon: Users, description: "Diagnóstico por pessoa" },
  { id: "trends", label: "Tendências", icon: LineChart, description: "Comparação com snapshot anterior" },
];

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
  const [insightType, setInsightType] = useState<InsightType>("executive");
  const [focus, setFocus] = useState("");
  const [appliedFocus, setAppliedFocus] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { getTemplate, isCustom } = useAiPromptTemplates();
  const effectiveTemplate = getTemplate(insightType);
  const customized = isCustom(insightType);

  // Hash template into cache key so editing the prompt invalidates the cache.
  const templateHash = useMemo(() => {
    let h = 0;
    for (let i = 0; i < effectiveTemplate.length; i++) {
      h = ((h << 5) - h + effectiveTemplate.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(36);
  }, [effectiveTemplate]);

  const cacheKey = useMemo(
    () =>
      `dashboard:${insightType}:${templateHash}:${appliedFocus || "_"}:${scopeKey ?? "default"}`,
    [insightType, templateHash, appliedFocus, scopeKey],
  );

  const { data, isLoading, error, generate, lastGeneratedAt } = useAiInsights<{
    periodo?: string;
    kpis: Record<string, string | number>;
    operadores: AiInsightsCardProps["operadores"];
    snapshotAnterior?: Record<string, string | number>;
    insightType: InsightType;
    focus?: string;
    template?: string;
  }>("dashboard", cacheKey);

  const onGenerate = (force = false) => {
    setAppliedFocus(focus.trim());
    return generate(
      {
        periodo,
        kpis,
        operadores,
        snapshotAnterior,
        insightType,
        focus: focus.trim() || undefined,
        template: customized ? effectiveTemplate : undefined,
      },
      { force },
    );
  };

  const activeType = INSIGHT_TYPES.find((t) => t.id === insightType)!;

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
              {activeType.description}
              {customized && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  Prompt personalizado
                </span>
              )}
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
            size="icon"
            variant="outline"
            onClick={() => setSettingsOpen(true)}
            className="h-8 w-8"
            title="Configurar templates de prompt"
            aria-label="Configurar templates de prompt"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
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

      {/* Type selector + focus */}
      <div className="space-y-3 border-b border-border bg-muted/20 px-5 py-3">
        <div className="flex flex-wrap gap-1.5">
          {INSIGHT_TYPES.map((t) => {
            const Icon = t.icon;
            const isActive = insightType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setInsightType(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-subtitle text-xs font-medium transition",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
                title={t.description}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onGenerate(true);
              }
            }}
            placeholder="Foco opcional (ex.: priorizar SLA estourado, comparar agentes X e Y…)"
            className="h-8 flex-1 min-w-[240px] text-xs"
            maxLength={500}
          />
          {focus && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => {
                setFocus("");
                setAppliedFocus("");
              }}
            >
              Limpar
            </Button>
          )}
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
            <activeType.icon className="mx-auto mb-2 h-6 w-6 text-primary/60" />
            <p className="font-subtitle text-sm font-medium text-foreground">
              Clique em "Gerar análise" para a visão "{activeType.label}"
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
      <AiPromptSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialType={insightType}
      />
    </section>
  );
};
