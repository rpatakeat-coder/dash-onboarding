import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpDown, Download, DollarSign, UserCheck, Building2 } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { toast } from "@/hooks/use-toast";
import {
  fmtBRL,
  fmtPct,
  grupoPerfil,
  type DashSucessoRow,
} from "@/hooks/useDashSucesso";

interface Props {
  rows: DashSucessoRow[];
  // Totais do overview view (denominadores)
  totalClientes: number;
  mrrTotal: number;
  qtdPMTotal: number;
  qtdGGGTotal: number;
  mrrPMTotal: number;
  mrrGGGTotal: number;
}

const num = (v: unknown): number => {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const fmtN = (n: number) => n.toLocaleString("pt-BR");

const esc = (v: unknown) => {
  const s = String(v ?? "");
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

type SortDir = "asc" | "desc";

export const RiscoEstoque = ({
  rows,
  totalClientes,
  mrrTotal,
  qtdPMTotal,
  qtdGGGTotal,
  mrrPMTotal,
  mrrGGGTotal,
}: Props) => {
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const risco = useMemo(
    () =>
      rows.filter(
        (r) =>
          (r.pipeline_nome ?? "").trim().toLowerCase() === "sucesso" &&
          (r.etapa_negocio ?? "").trim().toLowerCase() === "risco",
      ),
    [rows],
  );

  const stats = useMemo(() => {
    let qtdPM = 0, mrrPM = 0, qtdGGG = 0, mrrGGG = 0, mrrTot = 0;
    for (const r of risco) {
      const m = num(r.mrr);
      mrrTot += m;
      const g = grupoPerfil(r.perfil_cliente);
      if (g === "P+M") { qtdPM++; mrrPM += m; }
      else if (g === "G+GG") { qtdGGG++; mrrGGG += m; }
    }
    return { qtd: risco.length, mrr: mrrTot, qtdPM, mrrPM, qtdGGG, mrrGGG };
  }, [risco]);

  const sorted = useMemo(() => {
    const arr = [...risco];
    arr.sort((a, b) => (sortDir === "desc" ? num(b.mrr) - num(a.mrr) : num(a.mrr) - num(b.mrr)));
    return arr;
  }, [risco, sortDir]);

  const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

  const handleExport = () => {
    if (!sorted.length) {
      toast({ title: "Nada para exportar" });
      return;
    }
    const header = ["Cliente", "Perfil", "MRR", "Agente de Sucesso"].join(";");
    const body = sorted
      .map((r) =>
        [
          esc(r.nome_negocio),
          esc(r.perfil_cliente ?? "—"),
          esc(num(r.mrr).toFixed(2).replace(".", ",")),
          esc(r.agente_sucesso ?? "Sem responsável"),
        ].join(";"),
      )
      .join("\n");
    const blob = new Blob([`\uFEFF${header}\n${body}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes-em-risco-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10 text-warning">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-secondary">
            Estoque de Clientes em Risco
          </h2>
          <p className="font-small text-xs text-muted-foreground">
            Clientes do pipeline de Sucesso na etapa "Risco"
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <KpiCard
          label="Volume em Risco"
          value={`${fmtN(stats.qtd)} (${fmtPct(pct(stats.qtd, totalClientes), 1)})`}
          icon={AlertTriangle}
          tone="warning"
          hint="% sobre o estoque total do pipeline"
        />
        <KpiCard
          label="MRR em Risco"
          value={`${fmtBRL(stats.mrr)} (${fmtPct(pct(stats.mrr, mrrTotal), 1)})`}
          icon={DollarSign}
          tone="warning"
          hint="% sobre o MRR total do pipeline"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PerfilRiscoCard
          label="P+M em Risco"
          icon={UserCheck}
          qtd={stats.qtdPM}
          mrr={stats.mrrPM}
          qtdDen={qtdPMTotal}
          mrrDen={mrrPMTotal}
          tone="secondary"
        />
        <PerfilRiscoCard
          label="G+GG em Risco"
          icon={Building2}
          qtd={stats.qtdGGG}
          mrr={stats.mrrGGG}
          qtdDen={qtdGGGTotal}
          mrrDen={mrrGGGTotal}
          tone="primary"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm-soft sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-secondary">
              Lista Detalhada
            </h3>
            <p className="font-small text-xs text-muted-foreground">
              {fmtN(sorted.length)} clientes em risco
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 font-subtitle text-xs uppercase tracking-wide text-foreground transition hover:border-primary/40 hover:text-primary"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50">
              <tr className="font-subtitle text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left">Perfil</th>
                <th className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
                    className="inline-flex items-center gap-1 transition hover:text-foreground"
                  >
                    MRR <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-3 py-2 text-left">Agente de Sucesso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((r, i) => (
                <tr key={`${r.nome_negocio}-${i}`} className="hover:bg-muted/30">
                  <td className="px-3 py-2.5 font-medium text-foreground">{r.nome_negocio ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.perfil_cliente ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right font-numeric font-semibold">{fmtBRL(num(r.mrr))}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.agente_sucesso ?? "Sem responsável"}</td>
                </tr>
              ))}
              {!sorted.length && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Nenhum cliente em risco no momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

// ---- Subcomponente: card de perfil em risco ----
interface PerfilRiscoCardProps {
  label: string;
  icon: typeof AlertTriangle;
  qtd: number;
  mrr: number;
  qtdDen: number;
  mrrDen: number;
  tone: "primary" | "secondary" | "warning" | "success";
}

const toneMap: Record<PerfilRiscoCardProps["tone"], string> = {
  primary: "text-primary bg-primary/10",
  secondary: "text-secondary bg-secondary/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
};

const PerfilRiscoCard = ({ label, icon: Icon, qtd, mrr, qtdDen, mrrDen, tone }: PerfilRiscoCardProps) => {
  const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm-soft transition-all hover:shadow-md-soft hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-subtitle text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
          <div className="mt-3 space-y-3">
            <div>
              <p className="font-small text-[11px] uppercase tracking-wide text-muted-foreground">Clientes</p>
              <p className="font-numeric text-2xl font-bold text-foreground">
                {qtd.toLocaleString("pt-BR")}{" "}
                <span className="font-numeric text-sm font-semibold text-muted-foreground">
                  ({fmtPct(pct(qtd, qtdDen), 1)} do grupo)
                </span>
              </p>
            </div>
            <div>
              <p className="font-small text-[11px] uppercase tracking-wide text-muted-foreground">MRR</p>
              <p className="font-numeric text-xl font-bold text-foreground">
                {fmtBRL(mrr)}{" "}
                <span className="font-numeric text-sm font-semibold text-muted-foreground">
                  ({fmtPct(pct(mrr, mrrDen), 1)} do grupo)
                </span>
              </p>
            </div>
          </div>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${toneMap[tone]}`}>
          <Icon className="h-5 w-5" strokeWidth={2.25} />
        </div>
      </div>
    </div>
  );
};
