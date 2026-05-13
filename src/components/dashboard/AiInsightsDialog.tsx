import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AiInsightsCard } from "./AiInsightsCard";
import type { DashRow } from "@/hooks/useDashOperacoes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: DashRow[];
  filtroAtivadores: Set<string>;
  filtroEtapas: Set<string>;
}

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export const AiInsightsDialog = ({
  open,
  onOpenChange,
  rows,
  filtroAtivadores,
  filtroEtapas,
}: Props) => {
  const { kpis, operadores, scopeKey } = useMemo(() => {
    const total = rows.length;
    const mrr_total = rows.reduce((s, r) => s + num(r.mrr), 0);
    const slas = rows.map((r) => num(r.sla_dias_etapa));
    const sla_medio = slas.length ? slas.reduce((a, b) => a + b, 0) / slas.length : 0;
    const noPrazoCount = slas.filter((s) => s <= 30).length;
    const criticos = slas.filter((s) => s > 60).length;
    const ativados = rows.filter((r) => !!r.data_ativacao?.trim()).length;

    const kpis: Record<string, string | number> = {
      total_clientes: total,
      mrr_total_brl: Math.round(mrr_total),
      sla_medio_dias: Math.round(sla_medio * 10) / 10,
      pct_no_prazo: total ? Math.round((noPrazoCount / total) * 1000) / 10 : 0,
      criticos_60d: criticos,
      ativados_total: ativados,
    };

    const opMap = new Map<
      string,
      { ativos: number; criticos: number; slaSum: number; mrr: number }
    >();
    for (const r of rows) {
      const k = r.agente_ativacao?.trim() || "Sem responsável";
      const cur = opMap.get(k) ?? { ativos: 0, criticos: 0, slaSum: 0, mrr: 0 };
      cur.ativos += 1;
      const s = num(r.sla_dias_etapa);
      cur.slaSum += s;
      if (s > 60) cur.criticos += 1;
      cur.mrr += num(r.mrr);
      opMap.set(k, cur);
    }
    const operadores = [...opMap.entries()]
      .map(([nome, v]) => ({
        nome,
        ativos: v.ativos,
        criticos: v.criticos,
        slaMedio: v.ativos ? Math.round((v.slaSum / v.ativos) * 10) / 10 : 0,
        mrr: Math.round(v.mrr),
      }))
      .sort((a, b) => b.ativos - a.ativos);

    const scopeKey = JSON.stringify({
      a: [...filtroAtivadores].sort(),
      e: [...filtroEtapas].sort(),
      n: total,
    });

    return { kpis, operadores, scopeKey };
  }, [rows, filtroAtivadores, filtroEtapas]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Insights de IA</DialogTitle>
          <DialogDescription>
            Pergunte e peça análises sobre KPIs, ativadores, etapas e mais — refletindo os filtros aplicados.
          </DialogDescription>
        </DialogHeader>
        <AiInsightsCard kpis={kpis} operadores={operadores} scopeKey={scopeKey} />
      </DialogContent>
    </Dialog>
  );
};
