import { useMemo } from "react";
import { CalendarRange } from "lucide-react";
import {
  fmtBRL,
  fmtBRLk,
  parseActivationDate,
  parseDate,
  isChurnRow,
  type DashRow,
} from "@/hooks/useDashOperacoes";
import { InfoTooltip } from "./InfoTooltip";
import { cn } from "@/lib/utils";

interface Props {
  rows: DashRow[];
}

const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const toNum = (v: unknown) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export const RastroMensal = ({ rows }: Props) => {
  const now = new Date();
  const year = now.getFullYear();
  const currentMonth = now.getMonth();

  const data = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, m) => ({
      mes: m,
      mrrAtivado: 0,
      mrrCriado: 0,
      churnMrr: 0,
      dealsCriados: 0,
      dealsAtivados: 0,
      pmCount: 0,
      ggCount: 0,
      pmAtivCount: 0,
      ggAtivCount: 0,
    }));

    // mês 0 (dezembro do ano anterior) para servir de denominador do janeiro
    let mrrCriadoDezAnt = 0;

    for (const row of rows) {
      const perfil = (row.perfil_cliente ?? "").trim().split(/\s+/)[0]?.toUpperCase() ?? "";
      const da = parseActivationDate(row.data_ativacao);
      if (da && da.getFullYear() === year) {
        months[da.getMonth()].mrrAtivado += toNum(row.mrr);
        months[da.getMonth()].dealsAtivados += 1;
        if (perfil === "P" || perfil === "M") months[da.getMonth()].pmAtivCount += 1;
        else if (perfil === "G" || perfil === "GG") months[da.getMonth()].ggAtivCount += 1;
      }
      const dc = parseDate(row.data_criacao);
      if (dc) {
        if (dc.getFullYear() === year) {
          months[dc.getMonth()].mrrCriado += toNum(row.mrr);
          months[dc.getMonth()].dealsCriados += 1;
          if (perfil === "P" || perfil === "M") months[dc.getMonth()].pmCount += 1;
          else if (perfil === "G" || perfil === "GG") months[dc.getMonth()].ggCount += 1;
        } else if (dc.getFullYear() === year - 1 && dc.getMonth() === 11) {
          mrrCriadoDezAnt += toNum(row.mrr);
        }
      }

      // churn fechado no mês
      if (isChurnRow(row)) {
        const df = parseDate(row.data_fechamento);
        if (df && df.getFullYear() === year) {
          months[df.getMonth()].churnMrr += toNum(row.mrr);
        }
      }
    }

    return months.map((m, i) => {
      const denomAtivacao = i === 0 ? mrrCriadoDezAnt : months[i - 1].mrrCriado;
      const pctAtivacao = denomAtivacao > 0 ? (m.mrrAtivado / denomAtivacao) * 100 : 0;
      const pctChurn = m.mrrCriado > 0 ? (m.churnMrr / m.mrrCriado) * 100 : 0;
      const totalPerfil = m.pmCount + m.ggCount;
      const pctPm = totalPerfil > 0 ? (m.pmCount / totalPerfil) * 100 : 0;
      const pctGg = totalPerfil > 0 ? (m.ggCount / totalPerfil) * 100 : 0;
      const totalAtiv = m.pmAtivCount + m.ggAtivCount;
      const pctPmAtiv = totalAtiv > 0 ? (m.pmAtivCount / totalAtiv) * 100 : 0;
      const pctGgAtiv = totalAtiv > 0 ? (m.ggAtivCount / totalAtiv) * 100 : 0;
      return {
        ...m,
        pctAtivacao,
        pctChurn,
        pctPm,
        pctGg,
        pctPmAtiv,
        pctGgAtiv,
        isPast: i < currentMonth,
        isCurrent: i === currentMonth,
        isFuture: i > currentMonth,
      };
    });
  }, [rows, year, currentMonth]);



  const fmtPct = (v: number) =>
    v > 0
      ? `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`
      : "—";

  const cellTone = (m: (typeof data)[number]) =>
    m.isFuture ? "text-muted-foreground/50" : m.isCurrent ? "text-primary font-semibold" : "text-foreground";

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm-soft">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-subtitle text-[10px] uppercase tracking-widest text-primary">
              · Rastro mensal
            </span>
            <h2 className="font-display text-base font-semibold text-secondary">
              Como cada mês fechou · jan → dez/{year}
            </h2>
            <InfoTooltip text='Linha por métrica · coluna por mês. % MRR Ativado = MRR Ativado do mês ÷ MRR Criado do mês anterior × 100. % Churn Onboarding = MRR de deals em etapa "Churn" (pipeline Sucesso, origem Onboarding) fechados no mês ÷ MRR criado no mês × 100.' />
          </div>
        </div>
        <CalendarRange className="h-5 w-5 text-primary/70" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-left font-subtitle text-[10px] uppercase tracking-widest text-muted-foreground">
                Métrica
              </th>
              {data.map((m) => (
                <th
                  key={m.mes}
                  className={cn(
                    "px-3 py-2 text-center font-subtitle text-[10px] uppercase tracking-widest",
                    m.isCurrent
                      ? "bg-primary/10 text-primary"
                      : m.isFuture
                      ? "text-muted-foreground/50"
                      : "text-muted-foreground",
                  )}
                >
                  {MONTH_LABELS[m.mes]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/60">
              <td className="sticky left-0 z-10 bg-card px-3 py-2.5 font-subtitle text-xs font-semibold">
                % MRR Ativado
              </td>
              {data.map((m) => (
                <td
                  key={m.mes}
                  className={cn(
                    "px-3 py-2.5 text-center font-numeric text-xs tabular-nums",
                    cellTone(m),
                    m.isCurrent && "bg-primary/5",
                  )}
                >
                  {m.isFuture ? "—" : fmtPct(m.pctAtivacao)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-border/60">
              <td className="sticky left-0 z-10 bg-card px-3 py-2.5 font-subtitle text-xs font-semibold">
                MRR Ativado
              </td>
              {data.map((m) => (
                <td
                  key={m.mes}
                  className={cn(
                    "px-3 py-2.5 text-center font-numeric text-xs tabular-nums",
                    cellTone(m),
                    m.isCurrent && "bg-primary/5",
                  )}
                  title={m.isFuture ? undefined : fmtBRL(m.mrrAtivado)}
                >
                  {m.isFuture ? "—" : m.mrrAtivado > 0 ? fmtBRLk(m.mrrAtivado) : "—"}
                </td>
              ))}
            </tr>
            <tr className="border-b border-border/60">
              <td className="sticky left-0 z-10 bg-card px-3 py-2.5 font-subtitle text-xs font-semibold">
                MRR Criado
              </td>
              {data.map((m) => (
                <td
                  key={m.mes}
                  className={cn(
                    "px-3 py-2.5 text-center font-numeric text-xs tabular-nums",
                    cellTone(m),
                    m.isCurrent && "bg-primary/5",
                  )}
                  title={m.isFuture ? undefined : fmtBRL(m.mrrCriado)}
                >
                  {m.isFuture ? "—" : m.mrrCriado > 0 ? fmtBRLk(m.mrrCriado) : "—"}
                </td>
              ))}
            </tr>
            <tr className="border-b border-border/60">
              <td className="sticky left-0 z-10 bg-card px-3 py-2.5 font-subtitle text-xs font-semibold">
                Deals Criados
              </td>
              {data.map((m) => (
                <td
                  key={m.mes}
                  className={cn(
                    "px-3 py-2.5 text-center font-numeric text-xs tabular-nums",
                    cellTone(m),
                    m.isCurrent && "bg-primary/5",
                  )}
                >
                  {m.isFuture ? "—" : m.dealsCriados > 0 ? m.dealsCriados.toLocaleString("pt-BR") : "—"}
                </td>
              ))}
            </tr>
            <tr className="border-b border-border/60">
              <td className="sticky left-0 z-10 bg-card px-6 py-2 font-subtitle text-[11px] text-muted-foreground">
                Peso % P + M
              </td>
              {data.map((m) => (
                <td
                  key={m.mes}
                  className={cn(
                    "px-3 py-2 text-center font-numeric text-[11px] tabular-nums",
                    cellTone(m),
                    m.isCurrent && "bg-primary/5",
                  )}
                >
                  {m.isFuture ? "—" : fmtPct(m.pctPm)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-border/60">
              <td className="sticky left-0 z-10 bg-card px-6 py-2 font-subtitle text-[11px] text-muted-foreground">
                Peso % G + GG
              </td>
              {data.map((m) => (
                <td
                  key={m.mes}
                  className={cn(
                    "px-3 py-2 text-center font-numeric text-[11px] tabular-nums",
                    cellTone(m),
                    m.isCurrent && "bg-primary/5",
                  )}
                >
                  {m.isFuture ? "—" : fmtPct(m.pctGg)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-border/60">
              <td className="sticky left-0 z-10 bg-card px-3 py-2.5 font-subtitle text-xs font-semibold">
                Deals Ativados
              </td>
              {data.map((m) => (
                <td
                  key={m.mes}
                  className={cn(
                    "px-3 py-2.5 text-center font-numeric text-xs tabular-nums",
                    cellTone(m),
                    m.isCurrent && "bg-primary/5",
                  )}
                >
                  {m.isFuture ? "—" : m.dealsAtivados > 0 ? m.dealsAtivados.toLocaleString("pt-BR") : "—"}
                </td>
              ))}
            </tr>
            <tr className="border-b border-border/60">
              <td className="sticky left-0 z-10 bg-card px-6 py-2 font-subtitle text-[11px] text-muted-foreground">
                Peso % P + M
              </td>
              {data.map((m) => (
                <td
                  key={m.mes}
                  className={cn(
                    "px-3 py-2 text-center font-numeric text-[11px] tabular-nums",
                    cellTone(m),
                    m.isCurrent && "bg-primary/5",
                  )}
                >
                  {m.isFuture ? "—" : fmtPct(m.pctPmAtiv)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-border/60">
              <td className="sticky left-0 z-10 bg-card px-6 py-2 font-subtitle text-[11px] text-muted-foreground">
                Peso % G + GG
              </td>
              {data.map((m) => (
                <td
                  key={m.mes}
                  className={cn(
                    "px-3 py-2 text-center font-numeric text-[11px] tabular-nums",
                    cellTone(m),
                    m.isCurrent && "bg-primary/5",
                  )}
                >
                  {m.isFuture ? "—" : fmtPct(m.pctGgAtiv)}
                </td>
              ))}
            </tr>




            <tr>
              <td className="sticky left-0 z-10 bg-card px-3 py-2.5 font-subtitle text-xs font-semibold">
                % Churn Onboarding
              </td>
              {data.map((m) => {
                const tone = m.isFuture
                  ? "text-muted-foreground/50"
                  : m.pctChurn > 9
                  ? "text-destructive font-semibold"
                  : m.isCurrent
                  ? "text-primary font-semibold"
                  : "text-foreground";
                return (
                  <td
                    key={m.mes}
                    className={cn(
                      "px-3 py-2.5 text-center font-numeric text-xs tabular-nums",
                      tone,
                      m.isCurrent && "bg-primary/5",
                    )}
                  >
                    {m.isFuture ? "—" : fmtPct(m.pctChurn)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-3 font-small text-[11px] text-muted-foreground">
        Mês destacado = mês corrente · meses futuros aparecem em cinza. % Ativação usa MRR Criado do mês
        anterior como denominador. % Churn supera meta quando &gt; 9%.
      </p>
    </section>
  );
};
