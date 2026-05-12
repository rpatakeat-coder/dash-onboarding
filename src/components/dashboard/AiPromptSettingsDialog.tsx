import { useEffect, useState } from "react";
import { RotateCcw, Save, Settings2, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DEFAULT_INSIGHT_TEMPLATES,
  INSIGHT_TYPE_LABELS,
  InsightType,
} from "@/lib/aiPromptTemplates";
import { useAiPromptTemplates } from "@/hooks/useAiPromptTemplates";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType?: InsightType;
}

const TYPES: InsightType[] = ["executive", "risks", "opportunities", "operators", "trends"];

export const AiPromptSettingsDialog = ({ open, onOpenChange, initialType = "executive" }: Props) => {
  const { getTemplate, setTemplate, resetTemplate, resetAll, isCustom } = useAiPromptTemplates();
  const [active, setActive] = useState<InsightType>(initialType);
  const [draft, setDraft] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  // Reload draft when dialog opens or active type changes
  useEffect(() => {
    if (open) {
      setActive(initialType);
    }
  }, [open, initialType]);

  useEffect(() => {
    setDraft(getTemplate(active));
    setSavedFlash(false);
  }, [active, getTemplate, open]);

  const dirty = draft !== getTemplate(active);

  const handleSave = () => {
    setTemplate(active, draft);
    setSavedFlash(true);
    toast({
      title: "Template salvo",
      description: `Suas preferências para "${INSIGHT_TYPE_LABELS[active]}" foram aplicadas.`,
    });
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const handleResetCurrent = () => {
    resetTemplate(active);
    setDraft(DEFAULT_INSIGHT_TEMPLATES[active]);
    toast({ title: "Template restaurado", description: "Voltou ao padrão da IA." });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            Configurações de prompts da IA
          </DialogTitle>
          <DialogDescription>
            Edite o template enviado ao modelo para cada tipo de insight. As preferências ficam salvas neste navegador.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => {
            const customized = isCustom(t);
            const isActive = active === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setActive(t)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-subtitle text-xs font-medium transition",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {INSIGHT_TYPE_LABELS[t]}
                {customized && (
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isActive ? "bg-primary-foreground" : "bg-primary",
                    )}
                    title="Personalizado"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-subtitle text-[11px] uppercase tracking-wider text-muted-foreground">
              Template do prompt — {INSIGHT_TYPE_LABELS[active]}
            </p>
            <span className="font-small text-[11px] text-muted-foreground">
              {draft.length}/4000
            </span>
          </div>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 4000))}
            rows={14}
            className="font-mono text-xs"
            placeholder="Defina as seções e instruções que a IA deve seguir…"
          />
          <p className="font-small text-[11px] text-muted-foreground">
            Dica: use cabeçalhos <code>## Seção</code> e bullets para guiar o formato. KPIs, operadores e snapshot anterior já são enviados automaticamente.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={resetAll} className="text-xs text-muted-foreground">
            Restaurar todos os padrões
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleResetCurrent} disabled={!isCustom(active)}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Padrão
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!dirty}>
              {savedFlash ? (
                <><Check className="mr-1.5 h-3.5 w-3.5" /> Salvo</>
              ) : (
                <><Save className="mr-1.5 h-3.5 w-3.5" /> Salvar</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
