import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpDown, Download, DollarSign, UserCheck, Building2, ExternalLink } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { hubspotDealUrl } from "@/lib/hubspot";
import { SucessoClientesModal } from "@/components/sucesso/SucessoClientesModal";
import {
  fmtBRL,
  fmtPct,
  grupoPerfil,
  type DashSucessoRow,
} from "@/hooks/useDashSucesso";

const PAGE_SIZE_OPTS = [25, 50, 75, 100] as const;

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

  // Modal de lista (padrão Onboarding) acionado pelos KPIs.
  const [modal, setModal] = useState<{ title: string; rows: DashSucessoRow[] } | null>(null);
  const riscoPM = useMemo(() => risco.filter((r) => grupoPerfil(r.perfil_cliente) === "P+M"), [risco]);
  const riscoGGG = useMemo(() => risco.filter((r) => grupoPerfil(r.perfil_cliente) === "G+GG"), [risco]);

  // Paginação (25 por padrão; estende até 100).
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTS[0]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageSafe = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(pageSafe * pageSize, (pageSafe + 1) * pageSize);

  // Volta à primeira página quando o conjunto ou a ordenação muda.
  useEffect(() => { setPage(0); }, [risco, sortDir]);

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
        <button type="button" onClick={() => setModal({ title: "Clientes em risco", rows: sorted })} className="text-left">
          <KpiCard
            label="Volume em Risco"
            value={`${fmtN(stats.qtd)} (${fmtPct(pct(stats.qtd, totalClientes), 1)})`}
            icon={AlertTriangle}
            tone="warning"
            hint="Clique para ver a lista de clientes"
          />
        </button>
        <button type="button" onClick={() => setModal({ title: "Clientes em risco", rows: sorted })} className="text-left">
          <KpiCard
            label="MRR em Risco"
            value={`${fmtBRL(stats.mrr)} (${fmtPct(pct(stats.mrr, mrrTotal), 1)})`}
            icon={DollarSign}
            tone="warning"
            hint="Clique para ver a lista de clientes"
          />
        </button>
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
          onClick={() => setModal({ title: "Clientes em risco · P+M", rows: riscoPM })}
        />
        <PerfilRiscoCard
          label="G+GG em Risco"
          icon={Building2}
          qtd={stats.qtdGGG}
          mrr={stats.mrrGGG}
          qtdDen={qtdGGGTotal}
          mrrDen={mrrGGGTotal}
          tone="primary"
          onClick={() => setModal({ title: "Clientes em risco · G+GG", rows: riscoGGG })}
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
              {pageRows.map((r, i) => (
                <tr key={`${r.nome_negocio}-${pageSafe * pageSize + i}`} className="hover:bg-muted/30">
                  <td className="px-3 py-2.5 font-medium">
                    <a
                      href={hubspotDealUrl(r.id_deal)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/hs inline-flex items-center gap-1 text-foreground transition hover:text-primary hover:underline"
                      title="Abrir no HubSpot"
                    >
                      {r.nome_negocio ?? "—"}
                      <ExternalLink className="h-3 w-3 text-muted-foreground transition group-hover/hs:text-primary" />
                    </a>
                  </td>
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

        {sorted.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 font-subtitle text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>
                {`${pageSafe * pageSize + 1}–${Math.min(sorted.length, (pageSafe + 1) * pageSize)} de ${fmtN(sorted.length)}`}
              </span>
              <span className="mx-1 text-border">·</span>
              <label className="flex items-center gap-1.5">
                Por página
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                  className="rounded-md border border-border bg-background px-2 py-1 text-foreground"
                >
                  {PAGE_SIZE_OPTS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <button
                onClick={() => setPage(0)}
                disabled={pageSafe === 0}
                className="rounded-lg border border-border px-2.5 py-1.5 hover:border-primary/40 disabled:opacity-40"
                aria-label="Primeira página"
              >
                «
              </button>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={pageSafe === 0}
                className="rounded-lg border border-border px-2.5 py-1.5 hover:border-primary/40 disabled:opacity-40"
                aria-label="Página anterior"
              >
                <span className="hidden sm:inline">Anterior</span>
                <span className="sm:hidden">‹</span>
              </button>
              {(() => {
                const pages: number[] = [];
                const visible = 3;
                const start = Math.max(0, Math.min(pageSafe - Math.floor(visible / 2), totalPages - visible));
                const end = Math.min(totalPages, start + visible);
                for (let i = start; i < end; i++) pages.push(i);
                return pages.map((i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={cn(
                      "min-w-[34px] rounded-lg border px-2.5 py-1.5 tabular-nums",
                      i === pageSafe
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    {i + 1}
                  </button>
                ));
              })()}
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={pageSafe >= totalPages - 1}
                className="rounded-lg border border-border px-2.5 py-1.5 hover:border-primary/40 disabled:opacity-40"
                aria-label="Próxima página"
              >
                <span className="hidden sm:inline">Próxima</span>
                <span className="sm:hidden">›</span>
              </button>
              <button
                onClick={() => setPage(totalPages - 1)}
                disabled={pageSafe >= totalPages - 1}
                className="rounded-lg border border-border px-2.5 py-1.5 hover:border-primary/40 disabled:opacity-40"
                aria-label="Última página"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      <SucessoClientesModal
        open={!!modal}
        onOpenChange={(o) => { if (!o) setModal(null); }}
        title={modal?.title ?? ""}
        rows={modal?.rows ?? []}
      />
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
  onClick?: () => void;
}

const toneMap: Record<PerfilRiscoCardProps["tone"], string> = {
  primary: "text-primary bg-primary/10",
  secondary: "text-secondary bg-secondary/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
};

const PerfilRiscoCard = ({ label, icon: Icon, qtd, mrr, qtdDen, mrrDen, tone, onClick }: PerfilRiscoCardProps) => {
  const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
  const className = cn(
    "group relative w-full overflow-hidden rounded-2xl border border-border bg-card p-6 text-left shadow-sm-soft transition-all hover:shadow-md-soft hover:-translate-y-0.5",
    onClick && "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
  );
  const body = (
    <>
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
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
};
