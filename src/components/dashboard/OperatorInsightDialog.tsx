import { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  Loader2,
  Sparkles,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  History,
  GitCompare,
  Users,
} from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAiInsights } from "@/hooks/useAiInsights";
import { toast } from "@/hooks/use-toast";
import { fmtBRL, type OperatorStat } from "@/hooks/useDashOperacoes";
import { AiExportMenu } from "./AiExportMenu";
import { AiVersionsCompareDialog } from "./AiVersionsCompareDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operator: OperatorStat | null;
  /** Aggregated KPIs of the whole operation (passed as context). */
  contextoOperacao?: Record<string, string | number>;
  scopeKey?: string;
}

interface OperatorPayload {
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
  insightType: "operators";
  focus?: string;
}

const timeAgo = (ts: number) => {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "agora mesmo";
  if (m < 60) return `há ${m} min`;
  return `há ${Math.floor(m / 60)}h`;
};

export const OperatorInsightDialog = ({
  open,
  onOpenChange,
  operator,
  contextoOperacao,
  scopeKey,
}: Props) => {
  const cacheKey = operator
    ? `dashboard:operator:${operator.nome}:${scopeKey ?? "default"}`
    : "dashboard:operator:none";
  const {
    data,
    isLoading,
    error,
    generate,
    versions,
    activeIndex,
    selectVersion,
    lastGeneratedAt,
  } = useAiInsights<OperatorPayload>("dashboard", cacheKey);

  const [copied, setCopied] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  // Auto-generate on first open
  useEffect(() => {
    if (open && operator && !data && !isLoading) {
      doGenerate(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cacheKey]);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  const doGenerate = (force: boolean) => {
    if (!operator) return;
    return generate(
      {
        kpis: {
          ...(contextoOperacao ?? {}),
          [`${operator.nome}.ativos`]: operator.ativos,
          [`${operator.nome}.criticos`]: operator.bands.critico,
          [`${operator.nome}.alerta`]: operator.bands.alerta,
          [`${operator.nome}.atencao`]: operator.bands.atencao,
          [`${operator.nome}.saudaveis`]: operator.bands.saudavel,
          [`${operator.nome}.travados`]: operator.travados,
          [`${operator.nome}.tempoMedioDias`]: Number(operator.tempoMedio.toFixed(1)),
          [`${operator.nome}.mrrTotal`]: operator.mrr,
        },
        operadores: [
          {
            nome: operator.nome,
            ativos: operator.ativos,
            criticos: operator.bands.critico,
            slaMedio: Number(operator.tempoMedio.toFixed(1)),
            mrr: operator.mrr,
          },
        ],
        insightType: "operators",
      },
      { force },
    );
  };

  const handleCopy = async () => {
    if (!data?.content) return;
    try {
      await navigator.clipboard.writeText(data.content);
      setCopied(true);
      toast({ title: "Texto copiado", description: "Análise copiada para a área de transferência." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Análise por operador
              {operator && (
                <span className="font-subtitle text-xs font-normal text-muted-foreground">
                  · {operator.nome}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {operator && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 font-numeric text-sm sm:grid-cols-4">
              <Stat label="Ativos" value={operator.ativos} />
              <Stat
                label="Críticos"
                value={operator.bands.critico}
                tone={operator.bands.critico > 0 ? "danger" : undefined}
              />
              <Stat label="SLA médio" value={`${operator.tempoMedio.toFixed(1)}d`} />
              <Stat label="MRR" value={fmtBRL(operator.mrr)} />
            </div>
          )}

          {versions.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="inline-flex shrink-0 items-center gap-1 font-subtitle text-[10px] uppercase tracking-wider text-muted-foreground">
                <History className="h-3 w-3" /> Histórico
              </span>
              {versions.map((v, i) => {
                const isActive = i === activeIndex;
                const label = i === 0 ? "Atual" : `v${versions.length - i}`;
                const time = new Date(v.at).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <button
                    key={v.at}
                    type="button"
                    onClick={() => selectVersion(i)}
                    className={cn(
                      "shrink-0 rounded-full border px-2.5 py-0.5 font-subtitle text-[11px] transition",
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    {label} · {time}
                  </button>
                );
              })}
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto h-7 gap-1.5 px-2 text-xs"
                onClick={() => setCompareOpen(true)}
              >
                <GitCompare className="h-3.5 w-3.5" /> Comparar
              </Button>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 font-small text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLoading && !data && (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Gerando análise…
            </div>
          )}

          {data && (
            <div className="prose prose-sm max-h-[50vh] max-w-none overflow-y-auto text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-li:my-0.5">
              <ReactMarkdown>{data.content}</ReactMarkdown>
            </div>
          )}

          {operator && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="font-small text-xs text-muted-foreground">
                {lastGeneratedAt ? (
                  <>
                    Gerado {timeAgo(lastGeneratedAt)}
                    {data?.model ? ` · ${data.model}` : ""}
                  </>
                ) : (
                  <Users className="inline h-3.5 w-3.5" />
                )}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!data?.content || isLoading}
                  onClick={handleCopy}
                >
                  {copied ? (
                    <><Check className="mr-1.5 h-3.5 w-3.5" /> Copiado</>
                  ) : (
                    <><Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar</>
                  )}
                </Button>
                {data && (
                  <AiExportMenu
                    content={data.content}
                    auditContext={`operator:${operator.nome}`}
                    meta={{
                      title: `Insights da IA — Operador`,
                      subtitle: operator.nome,
                      typeLabel: "Operadores",
                      model: data.model,
                      generatedAt: lastGeneratedAt ?? Date.now(),
                    }}
                  />
                )}
                <Button
                  size="sm"
                  variant={data ? "outline" : "default"}
                  disabled={isLoading}
                  onClick={() => doGenerate(true)}
                >
                  {isLoading ? (
                    <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Analisando…</>
                  ) : data ? (
                    <><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Regenerar</>
                  ) : (
                    <><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Analisar</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {operator && (
        <AiVersionsCompareDialog
          open={compareOpen}
          onOpenChange={setCompareOpen}
          versions={versions}
          title={`Análise · ${operator.nome}`}
          typeLabel="Operadores"
        />
      )}
    </>
  );
};

const Stat = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "danger";
}) => (
  <div>
    <p className="font-subtitle text-[10px] uppercase tracking-wider text-muted-foreground">
      {label}
    </p>
    <p
      className={cn(
        "font-semibold",
        tone === "danger" ? "text-destructive" : "text-foreground",
      )}
    >
      {value}
    </p>
  </div>
);
