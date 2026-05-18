import { useMemo, useState } from "react";
import { GitCompare, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SlaBandBar } from "./SlaBandBar";
import { MultiSelectFilter } from "./MultiSelectFilter";
import {
  fmtBRLk,
  fmtDias,
  fmtPct,
  parseActivationDate,
  type DashRow,
  type OperatorStat,
} from "@/hooks/useDashOperacoes";

interface Props {
  rows: DashRow[];
  operadores: OperatorStat[];
}

interface Metric {
  key: string;
  label: string;
  values: { nome: string; raw: number; display: string }[];
  better: "high" | "low";
}

const PERFIL_ORDER = ["P", "M", "G", "GG"];

export const OperatorCompareSheet = ({ rows, operadores }: Props) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allNames = useMemo(() => operadores.map((o) => o.nome), [operadores]);

  const ativ30dByOp = useMemo(() => {
    const now = new Date();
    const start = new Date(now); start.setDate(now.getDate() - 30);
    const m = new Map<string, number>();
    for (const r of rows) {
      const d = parseActivationDate(r.data_ativacao);
      if (!d || d < start) continue;
      const k = r.agente_ativacao?.trim() || "Sem responsável";
      m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
  }, [rows]);

  const perfilByOp = useMemo(() => {
    const out = new Map<string, Record<string, number>>();
    for (const op of operadores) {
      const mix: Record<string, number> = {};
      for (const c of op.clientes) mix[c.perfil] = (mix[c.perfil] || 0) + 1;
      out.set(op.nome, mix);
    }
    return out;
  }, [operadores]);

  const picked = useMemo(() => {
    const list = operadores.filter((o) => selected.has(o.nome));
    return list.slice(0, 4);
  }, [operadores, selected]);

  const metrics: Metric[] = useMemo(() => {
    if (picked.length < 2) return [];
    const noPrazo = (o: OperatorStat) => {
      const ok = o.bands.saudavel + o.bands.alerta;
      return o.ativos > 0 ? (ok / o.ativos) * 100 : 0;
    };
    return [
      {
        key: "ativos",
        label: "Clientes ativos",
        better: "high",
        values: picked.map((o) => ({ nome: o.nome, raw: o.ativos, display: String(o.ativos) })),
      },
      {
        key: "mrr",
        label: "MRR sob gestão",
        better: "high",
        values: picked.map((o) => ({ nome: o.nome, raw: o.mrr, display: fmtBRLk(o.mrr) })),
      },
      {
        key: "sla",
        label: "SLA médio",
        better: "low",
        values: picked.map((o) => ({ nome: o.nome, raw: o.tempoMedio, display: fmtDias(o.tempoMedio) })),
      },
      {
        key: "noprazo",
        label: "% no prazo",
        better: "high",
        values: picked.map((o) => {
          const v = noPrazo(o);
          return { nome: o.nome, raw: v, display: fmtPct(v) };
        }),
      },
      {
        key: "criticos",
        label: "Críticos",
        better: "low",
        values: picked.map((o) => ({ nome: o.nome, raw: o.bands.critico, display: String(o.bands.critico) })),
      },
      {
        key: "ativ30",
        label: "Ativações (30d)",
        better: "high",
        values: picked.map((o) => {
          const v = ativ30dByOp.get(o.nome) || 0;
          return { nome: o.nome, raw: v, display: String(v) };
        }),
      },
    ];
  }, [picked, ativ30dByOp]);

  const champion = (m: Metric) => {
    if (!m.values.length) return null;
    const fn = m.better === "high" ? Math.max : Math.min;
    const best = fn(...m.values.map((v) => v.raw));
    return best;
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2">
          <GitCompare className="h-3.5 w-3.5" />
          Comparar
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle className="font-display">Comparativo entre operadores</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelectFilter
              label="Selecione 2–4 ativadores"
              options={allNames}
              selected={selected}
              onChange={(next) => {
                if (next.size > 4) {
                  // mantém apenas os 4 primeiros adicionados
                  const arr = [...next].slice(0, 4);
                  setSelected(new Set(arr));
                } else {
                  setSelected(next);
                }
              }}
            />
            {selected.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set())}
                className="h-8 gap-1 text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" /> Limpar
              </Button>
            )}
            <span className="ml-auto font-small text-xs text-muted-foreground">
              {picked.length} selecionado{picked.length === 1 ? "" : "s"}
            </span>
          </div>

          {picked.length < 2 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center font-subtitle text-sm text-muted-foreground">
              Selecione pelo menos 2 ativadores para comparar.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Cabeçalho com nomes */}
              <div className={cn("grid gap-2", `grid-cols-${picked.length + 1}`)} style={{ gridTemplateColumns: `140px repeat(${picked.length}, minmax(0, 1fr))` }}>
                <div />
                {picked.map((o) => (
                  <div key={o.nome} className="truncate rounded-lg border border-border bg-card px-3 py-2 font-subtitle text-xs font-semibold text-foreground" title={o.nome}>
                    {o.nome}
                  </div>
                ))}
              </div>

              {/* Métricas */}
              {metrics.map((m) => {
                const best = champion(m);
                return (
                  <div
                    key={m.key}
                    className="grid items-center gap-2"
                    style={{ gridTemplateColumns: `140px repeat(${picked.length}, minmax(0, 1fr))` }}
                  >
                    <div className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
                      {m.label}
                    </div>
                    {m.values.map((v) => {
                      const isBest = best != null && v.raw === best && picked.length > 1;
                      return (
                        <div
                          key={v.nome}
                          className={cn(
                            "rounded-lg border border-border bg-background px-3 py-2 font-numeric text-sm font-semibold tabular-nums text-foreground",
                            isBest && "ring-1 ring-primary/60 bg-primary/[0.06]",
                          )}
                        >
                          {v.display}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Distribuição de bands */}
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `140px repeat(${picked.length}, minmax(0, 1fr))` }}
              >
                <div className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
                  Distribuição SLA
                </div>
                {picked.map((o) => (
                  <div key={o.nome} className="rounded-lg border border-border bg-background p-2">
                    <SlaBandBar bands={o.bands} height="md" />
                  </div>
                ))}
              </div>

              {/* Mix de perfis */}
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `140px repeat(${picked.length}, minmax(0, 1fr))` }}
              >
                <div className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
                  Mix de perfis
                </div>
                {picked.map((o) => {
                  const mix = perfilByOp.get(o.nome) || {};
                  return (
                    <div key={o.nome} className="flex flex-wrap gap-1 rounded-lg border border-border bg-background px-2 py-2">
                      {PERFIL_ORDER.filter((p) => mix[p]).map((p) => (
                        <span key={p} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-numeric text-[11px] font-semibold text-foreground">
                          {p} <span className="text-muted-foreground">{mix[p]}</span>
                        </span>
                      ))}
                      {Object.keys(mix).length === 0 && (
                        <span className="font-small text-[11px] text-muted-foreground">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
