import { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, Sparkles, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAiInsights } from "@/hooks/useAiInsights";

export interface ExplainKpiTarget {
  kpiName: string;
  valorAtual: string | number;
  valorAnterior?: string | number;
  contexto?: string;
}

interface ExplainKpiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ExplainKpiTarget | null;
}

export const ExplainKpiDialog = ({ open, onOpenChange, target }: ExplainKpiDialogProps) => {
  const cacheKey = target
    ? `kpi:${target.kpiName}:${target.valorAtual}:${target.valorAnterior ?? ""}`
    : "kpi:none";
  const { data, isLoading, error, generate } = useAiInsights<ExplainKpiTarget>("kpi", cacheKey);

  useEffect(() => {
    if (open && target && !data && !isLoading) {
      generate(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cacheKey]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Explicar KPI
            {target && (
              <span className="font-subtitle text-xs font-normal text-muted-foreground">
                · {target.kpiName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {target && (
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 font-numeric text-sm">
            <div>
              <p className="font-subtitle text-[10px] uppercase tracking-wider text-muted-foreground">
                Atual
              </p>
              <p className="font-semibold text-foreground">{target.valorAtual}</p>
            </div>
            {target.valorAnterior !== undefined && (
              <div>
                <p className="font-subtitle text-[10px] uppercase tracking-wider text-muted-foreground">
                  Anterior
                </p>
                <p className="font-semibold text-foreground">{target.valorAnterior}</p>
              </div>
            )}
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
            <Loader2 className="h-4 w-4 animate-spin" /> Gerando explicação…
          </div>
        )}

        {data && (
          <div className="prose prose-sm max-w-none text-foreground prose-strong:text-foreground prose-p:my-2">
            <ReactMarkdown>{data.content}</ReactMarkdown>
          </div>
        )}

        {target && (
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={isLoading}
              onClick={() => generate(target, { force: true })}
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Regenerar"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
