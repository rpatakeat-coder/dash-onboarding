import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SlaBandBar } from "./SlaBandBar";
import {
  SLA_BAND_META,
  fmtBRL,
  type OperatorStat,
  type SlaBand,
} from "@/hooks/useDashOperacoes";

interface Props {
  operador: OperatorStat | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const ORDER: SlaBand[] = ["critico", "atencao", "alerta", "saudavel"];

export const OperatorCarteiraModal = ({ operador, open, onOpenChange }: Props) => {
  const [expanded, setExpanded] = useState<Record<SlaBand, boolean>>({
    critico: true,
    atencao: true,
    alerta: true,
    saudavel: false,
  });

  const grouped = useMemo(() => {
    if (!operador) return {} as Record<SlaBand, OperatorStat["clientes"]>;
    const g: Record<SlaBand, OperatorStat["clientes"]> = {
      critico: [], atencao: [], alerta: [], saudavel: [],
    };
    for (const c of operador.clientes) g[c.band].push(c);
    for (const k of ORDER) g[k].sort((a, b) => b.sla - a.sla);
    return g;
  }, [operador]);

  if (!operador) return null;

  const toggle = (k: SlaBand) =>
    setExpanded((s) => ({ ...s, [k]: !s[k] }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Carteira · {operador.nome}
          </DialogTitle>
          <DialogDescription>
            {operador.ativos} clientes · {fmtBRL(operador.mrr)} sob gestão · SLA médio{" "}
            {operador.tempoMedio.toFixed(1)}d
          </DialogDescription>
        </DialogHeader>

        <SlaBandBar bands={operador.bands} height="lg" showLabels />

        <div className="mt-2 max-h-[55vh] space-y-3 overflow-auto pr-1">
          {ORDER.map((k) => {
            const meta = SLA_BAND_META[k];
            const list = grouped[k];
            const count = operador.bands[k];
            const mrr = operador.bandsMrr[k];
            const isOpen = expanded[k];
            const color = `hsl(var(${meta.cssVar}))`;
            return (
              <div
                key={k}
                className="overflow-hidden rounded-xl border"
                style={{ borderColor: count > 0 ? color : undefined }}
              >
                <button
                  onClick={() => toggle(k)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-muted/50"
                  style={{
                    backgroundColor: count > 0 ? `${color.replace("hsl(", "hsla(").replace(")", ", 0.08)")}` : undefined,
                  }}
                >
                  <div className="flex items-center gap-3">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <div>
                      <p className="font-subtitle text-sm font-semibold text-foreground">
                        {meta.label}{" "}
                        <span className="font-normal text-muted-foreground">({meta.range})</span>
                      </p>
                      <p className="font-small text-[11px] text-muted-foreground">
                        {count} cliente{count === 1 ? "" : "s"} · {fmtBRL(mrr)}
                      </p>
                    </div>
                  </div>
                </button>
                {isOpen && count > 0 && (
                  <ul className="divide-y divide-border bg-card">
                    {list.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between gap-3 px-4 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-subtitle text-sm font-semibold text-foreground">
                            {c.cliente}
                          </p>
                          <p className="truncate font-small text-[11px] text-muted-foreground">
                            {c.etapa} · perfil {c.perfil}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3 text-right">
                          <span className="font-numeric text-xs text-muted-foreground">
                            {c.mrr ? fmtBRL(c.mrr) : "—"}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 font-numeric text-xs font-bold tabular-nums",
                            )}
                            style={{
                              backgroundColor: `${color.replace("hsl(", "hsla(").replace(")", ", 0.15)")}`,
                              color,
                            }}
                          >
                            {c.sla.toFixed(0)}d
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {isOpen && count === 0 && (
                  <p className="bg-card px-4 py-3 font-small text-xs text-muted-foreground">
                    Nenhum cliente nessa faixa.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
