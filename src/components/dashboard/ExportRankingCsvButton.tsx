import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import type { OperatorStat, PeriodKey } from "@/hooks/useDashOperacoes";

interface Props {
  operadores: OperatorStat[];
  period: PeriodKey;
}

const COLS: Array<[string, (o: OperatorStat) => string | number]> = [
  ["Ativador", (o) => o.nome],
  ["Ativos", (o) => o.ativos],
  ["MRR (R$)", (o) => o.mrr.toFixed(2).replace(".", ",")],
  ["SLA médio (dias)", (o) => o.tempoMedio.toFixed(1).replace(".", ",")],
  ["Críticos", (o) => o.bands.critico],
  ["Atenção", (o) => o.bands.atencao],
  ["Alerta", (o) => o.bands.alerta],
  ["Saudáveis", (o) => o.bands.saudavel],
  ["% no prazo", (o) => {
    const ok = o.bands.saudavel + o.bands.alerta;
    return o.ativos > 0 ? ((ok / o.ativos) * 100).toFixed(1).replace(".", ",") : "0,0";
  }],
];

const escape = (v: unknown) => {
  const s = String(v ?? "");
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

export const ExportRankingCsvButton = ({ operadores, period }: Props) => {
  const handle = () => {
    if (!operadores.length) {
      toast({ title: "Nada para exportar", description: "Nenhum ativador no escopo atual." });
      return;
    }
    const header = COLS.map(([l]) => l).join(";");
    const body = operadores.map((o) => COLS.map(([, fn]) => escape(fn(o))).join(";")).join("\n");
    const csv = "\uFEFF" + header + "\n" + body;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `gestao_ranking_${period}_${date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast({ title: "Ranking exportado", description: `${operadores.length} ativadores no CSV.` });
  };

  return (
    <Button variant="outline" size="sm" className="h-9 gap-2" onClick={handle}>
      <Download className="h-3.5 w-3.5" />
      Exportar ranking
    </Button>
  );
};
