import { useMemo, useState } from "react";
import { DollarSign, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtBRL, filterByPeriod, type DashRow, type PeriodKey } from "@/hooks/useDashOperacoes";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "./InfoTooltip";
import { PeriodFilter } from "./PeriodFilter";

interface Props {
  rows: DashRow[];
}

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Tolerância (R$) para considerar igual entre Hubspot e Asaas. */
const EPS = 0.5;

export const MrrAsaasKpis = ({ rows }: Props) => {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>("tudo");

  const periodRows = useMemo(() => filterByPeriod(rows, period), [rows, period]);

  const data = useMemo(() => {
    // Considera apenas deals que possuem vínculo com Asaas (asaas_id presente).
    const withAsaas = periodRows.filter((r) => (r.asaas_id?.trim() ?? "") !== "");
    const totalHubspot = withAsaas.reduce((s, r) => s + num(r.mrr), 0);
    const totalAsaas = withAsaas.reduce((s, r) => s + num(r.mrr_asaas), 0);
    const diff = totalAsaas - totalHubspot;
    const diffPct = totalHubspot > 0 ? (diff / totalHubspot) * 100 : 0;

    const divergentes = withAsaas
      .map((r) => {
        const h = num(r.mrr);
        const a = num(r.mrr_asaas);
        return { row: r, hubspot: h, asaas: a, delta: a - h };
      })
      .filter((x) => Math.abs(x.delta) > EPS)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    return {
      totalHubspot,
      totalAsaas,
      diff,
      diffPct,
      countWithAsaas: withAsaas.length,
      countSemAsaas: periodRows.length - withAsaas.length,
      divergentes,
    };
  }, [periodRows]);

  const positive = data.diff >= 0;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm-soft">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold text-secondary">
            MRR Hubspot × Asaas
          </h2>
          <p className="font-small text-xs text-muted-foreground">
            Comparativo entre o MRR registrado no Hubspot e o MRR efetivamente cobrado no Asaas
          </p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>


      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* MRR Hubspot */}
        <div className="rounded-xl border border-primary/30 bg-primary/[0.04] p-4">
          <div className="flex items-start justify-between">
            <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              MRR Hubspot
            </p>
            <div className="flex items-center gap-1.5">
              <InfoTooltip text="Soma do MRR registrado no campo `mrr` do Hubspot, considerando apenas deals que possuem vínculo com Asaas (asaas_id preenchido)." />
              <DollarSign className="h-4 w-4 text-primary/70" />
            </div>
          </div>
          <p className="mt-2 font-numeric text-3xl font-bold text-primary">
            {fmtBRL(data.totalHubspot)}
          </p>
          <p className="mt-1 font-small text-xs text-muted-foreground">
            {data.countWithAsaas} deals com Asaas
          </p>
        </div>

        {/* MRR Asaas */}
        <div className="rounded-xl border border-success/30 bg-success/[0.04] p-4">
          <div className="flex items-start justify-between">
            <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              MRR Asaas
            </p>
            <div className="flex items-center gap-1.5">
              <InfoTooltip text="Soma do MRR cobrado de fato no Asaas (campo `mrr_asaas`). Representa a receita recorrente real que está sendo faturada." />
              <DollarSign className="h-4 w-4 text-success/70" />
            </div>
          </div>
          <p className="mt-2 font-numeric text-3xl font-bold text-success">
            {fmtBRL(data.totalAsaas)}
          </p>
          <p className="mt-1 font-small text-xs text-muted-foreground">
            cobrado no faturamento
          </p>
        </div>

        {/* Diferença */}
        <div
          className={cn(
            "rounded-xl border p-4",
            positive
              ? "border-success/30 bg-success/[0.04]"
              : "border-destructive/30 bg-destructive/[0.04]",
          )}
        >
          <div className="flex items-start justify-between">
            <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              Diferença (Asaas − Hub)
            </p>
            <div className="flex items-center gap-1.5">
              <InfoTooltip text="Asaas − Hubspot. Positivo significa que estamos cobrando MAIS no Asaas do que o registrado no Hubspot; negativo indica receita potencialmente perdida (cobrando menos do que o contratado)." />
              {positive ? (
                <TrendingUp className="h-4 w-4 text-success/80" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive/80" />
              )}
            </div>
          </div>
          <p
            className={cn(
              "mt-2 font-numeric text-3xl font-bold",
              positive ? "text-success" : "text-destructive",
            )}
          >
            {positive ? "+" : ""}
            {fmtBRL(data.diff)}
          </p>
          <p className="mt-1 font-small text-xs text-muted-foreground">
            {positive ? "+" : ""}
            {data.diffPct.toFixed(1)}% vs Hubspot
          </p>
        </div>

        {/* Deals divergentes (clicável) */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group rounded-xl border border-secondary/30 bg-secondary/[0.04] p-4 text-left transition hover:opacity-90"
        >
          <div className="flex items-start justify-between">
            <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              Deals divergentes
            </p>
            <div className="flex items-center gap-1.5">
              <InfoTooltip text="Quantidade de deals em que o MRR do Hubspot difere do MRR do Asaas (tolerância de R$ 0,50). Clique no card para ver a lista completa." />
              <AlertTriangle className="h-4 w-4 text-secondary/80" />
            </div>
          </div>
          <p className="mt-2 font-numeric text-3xl font-bold text-secondary">
            {data.divergentes.length}
          </p>
          <p className="mt-1 font-small text-xs text-muted-foreground">
            {data.countSemAsaas > 0
              ? `${data.countSemAsaas} sem Asaas vinculado`
              : "clique para detalhar →"}
          </p>
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Deals com divergência Hubspot × Asaas</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Negócio</TableHead>
                  <TableHead className="text-right">Hubspot</TableHead>
                  <TableHead className="text-right">Asaas</TableHead>
                  <TableHead className="text-right">Δ</TableHead>
                  <TableHead>Ativador</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.divergentes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum deal divergente.
                    </TableCell>
                  </TableRow>
                )}
                {data.divergentes.map(({ row, hubspot, asaas, delta }) => {
                  const pos = delta >= 0;
                  return (
                    <TableRow key={row.id_deal}>
                      <TableCell className="font-medium">
                        {row.nome_negocio || "—"}
                      </TableCell>
                      <TableCell className="text-right font-numeric tabular-nums">
                        {fmtBRL(hubspot)}
                      </TableCell>
                      <TableCell className="text-right font-numeric tabular-nums">
                        {fmtBRL(asaas)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-numeric font-semibold tabular-nums",
                          pos ? "text-success" : "text-destructive",
                        )}
                      >
                        {pos ? "+" : ""}
                        {fmtBRL(delta)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.agente_ativacao || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};
