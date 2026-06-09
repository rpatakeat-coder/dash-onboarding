import { useMemo, useState } from "react";
import { Medal, Trophy, CalendarIcon, X, User } from "lucide-react";
import { useAgentAvatars } from "@/hooks/useAgentAvatars";
import { usePodiumMedals } from "@/hooks/usePodiumMedals";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import {
  parseDate,
  parseActivationDate,
  isChurnRow,
  type DashRow,
} from "@/hooks/useDashOperacoes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DealLink } from "./DealLink";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";

export type PeriodKey = "semana" | "mes" | "trimestre" | "custom";

export interface CustomRange { start: Date; end: Date }

interface Props {
  rows: DashRow[];
  variant?: "default" | "tv";
}

export interface ScoreRow {
  ativador: string;
  pctMrr: number;
  pctClientes: number;
  pctChurn: number;
  scoreFinal: number;
  mrrAtivado: number;
  clientesAtivados: number;
}

const toNum = (v: string | null | undefined) => {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

const startOfWeek = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // segunda = 0
  x.setDate(x.getDate() - day);
  return x;
};

const startOfQuarter = (d: Date) => {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
};

const getRanges = (period: PeriodKey, custom?: CustomRange) => {
  const now = new Date();
  if (period === "custom" && custom) {
    const start = new Date(custom.start.getFullYear(), custom.start.getMonth(), custom.start.getDate());
    const end = new Date(custom.end.getFullYear(), custom.end.getMonth(), custom.end.getDate());
    end.setDate(end.getDate() + 1); // inclusive end
    const ms = end.getTime() - start.getTime();
    const prevEnd = start;
    const prevStart = new Date(start.getTime() - ms);
    return { start, end, prevStart, prevEnd };
  }
  if (period === "semana") {
    const start = startOfWeek(now);
    const end = new Date(start); end.setDate(end.getDate() + 7);
    const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 7);
    return { start, end, prevStart, prevEnd: start };
  }
  if (period === "trimestre") {
    const start = startOfQuarter(now);
    const end = new Date(start.getFullYear(), start.getMonth() + 3, 1);
    const prevStart = new Date(start.getFullYear(), start.getMonth() - 3, 1);
    return { start, end, prevStart, prevEnd: start };
  }
  // mes
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { start, end, prevStart, prevEnd: start };
};

export const computeRanking = (rows: DashRow[], period: PeriodKey, custom?: CustomRange): { ranked: ScoreRow[]; team: ScoreRow } => {
  const { start, end, prevStart, prevEnd } = getRanges(period, custom);
  const inCur = (d: Date | null) => !!d && d >= start && d < end;
  const inPrev = (d: Date | null) => !!d && d >= prevStart && d < prevEnd;

  const map = new Map<string, {
    mrrAtivado: number; mrrCriadoAnterior: number;
    clientesAtivados: number; clientesCriadosAnterior: number;
    churnReal: number;
  }>();
  const ensure = (k: string) => {
    let c = map.get(k);
    if (!c) {
      c = { mrrAtivado: 0, mrrCriadoAnterior: 0, clientesAtivados: 0, clientesCriadosAnterior: 0, churnReal: 0 };
      map.set(k, c);
    }
    return c;
  };

  for (const r of rows) {
    const agente = r.agente_ativacao?.trim();
    if (!agente) continue;
    const mrr = toNum(r.mrr);
    const dCriacao = parseDate(r.data_criacao);
    if (inPrev(dCriacao)) {
      const c = ensure(agente);
      c.mrrCriadoAnterior += mrr;
      c.clientesCriadosAnterior += 1;
    }
    if (inCur(parseActivationDate(r.data_ativacao))) {
      const c = ensure(agente);
      c.mrrAtivado += mrr;
      c.clientesAtivados += 1;
    }
    if (isChurnRow(r) && inCur(parseDate(r.data_fechamento))) {
      ensure(agente).churnReal += mrr;
    }
  }

  const out: ScoreRow[] = [];
  let tMrrAt = 0, tMrrAnt = 0, tCliAt = 0, tCliAnt = 0, tChurn = 0;
  map.forEach((c, ativador) => {
    tMrrAt += c.mrrAtivado; tMrrAnt += c.mrrCriadoAnterior;
    tCliAt += c.clientesAtivados; tCliAnt += c.clientesCriadosAnterior;
    tChurn += c.churnReal;
    const pctMrr = c.mrrCriadoAnterior > 0 ? (c.mrrAtivado / c.mrrCriadoAnterior) * 100 : 0;
    const pctClientes = c.clientesCriadosAnterior > 0 ? (c.clientesAtivados / c.clientesCriadosAnterior) * 100 : 0;
    const churnMax = c.mrrCriadoAnterior * 0.09;
    const pctChurn = churnMax > 0 ? (c.churnReal / churnMax) * 100 : 0;
    const churnPenalty = pctChurn > 100 ? (pctChurn - 100) * 10 : 0;
    const scoreFinal = Math.max(0, (pctMrr * 60 + pctClientes * 30 - churnPenalty) / 100);
    out.push({
      ativador, pctMrr, pctClientes, pctChurn, scoreFinal,
      mrrAtivado: c.mrrAtivado, clientesAtivados: c.clientesAtivados,
    });
  });

  const tPctMrr = tMrrAnt > 0 ? (tMrrAt / tMrrAnt) * 100 : 0;
  const tPctCli = tCliAnt > 0 ? (tCliAt / tCliAnt) * 100 : 0;
  const tChurnMax = tMrrAnt * 0.09;
  const tPctChurn = tChurnMax > 0 ? (tChurn / tChurnMax) * 100 : 0;
  const tPen = tPctChurn > 100 ? (tPctChurn - 100) * 10 : 0;
  const teamScore = Math.max(0, (tPctMrr * 60 + tPctCli * 30 - tPen) / 100);
  const team: ScoreRow = {
    ativador: "Time",
    pctMrr: tPctMrr, pctClientes: tPctCli, pctChurn: tPctChurn,
    scoreFinal: teamScore, mrrAtivado: tMrrAt, clientesAtivados: tCliAt,
  };

  const ranked = out
    .filter((r) => r.scoreFinal > 0 || r.mrrAtivado > 0 || r.clientesAtivados > 0)
    .sort((a, b) => b.scoreFinal - a.scoreFinal);
  return { ranked, team };
};

const MEDAL_STYLES = [
  { bg: "from-amber-400/30 to-amber-500/10", ring: "ring-amber-400/60", text: "text-amber-400", label: "Ouro" },
  { bg: "from-slate-300/30 to-slate-400/10", ring: "ring-slate-300/60", text: "text-slate-300", label: "Prata" },
  { bg: "from-orange-600/30 to-orange-700/10", ring: "ring-orange-500/60", text: "text-orange-400", label: "Bronze" },
];

type GetMedalCounts = (ativador: string) => { gold: number; silver: number; bronze: number };

interface MedalBadgesProps {
  ativador: string;
  size?: "sm" | "md";
  getMedalCounts: GetMedalCounts;
  className?: string;
}

const MedalBadges = ({ ativador, size = "sm", getMedalCounts, className }: MedalBadgesProps) => {
  const { gold, silver, bronze } = getMedalCounts(ativador);
  if (gold === 0 && silver === 0 && bronze === 0) return null;

  const iconCls = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  const textCls = size === "md" ? "text-sm" : "text-xs";
  const padCls = size === "md" ? "px-1.5 py-0.5" : "px-1 py-0.5";

  const Pill = ({ count, color }: { count: number; color: string }) => (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border bg-card/60",
        padCls,
      )}
    >
      <Medal className={cn(iconCls, color)} />
      <span className={cn("font-numeric font-semibold tabular-nums text-foreground", textCls)}>
        {count}
      </span>
    </span>
  );

  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      {gold > 0 && <Pill count={gold} color="text-amber-400" />}
      {silver > 0 && <Pill count={silver} color="text-slate-300" />}
      {bronze > 0 && <Pill count={bronze} color="text-orange-400" />}
    </div>
  );
};

const PERIOD_LABELS: Record<PeriodKey, string> = {
  semana: "Semana",
  mes: "Mês",
  trimestre: "Trimestre",
  custom: "Personalizado",
};

const toInputDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const fromInputDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

export const RankingMetasMedalhas = ({ rows, variant = "default" }: Props) => {
  const [period, setPeriod] = useState<PeriodKey>("mes");
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [customRange, setCustomRange] = useState<DateRange | undefined>({ from: firstOfMonth, to: today });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedAtivador, setSelectedAtivador] = useState<string | null>(null);

  const customStart = customRange?.from ?? firstOfMonth;
  const customEnd = customRange?.to ?? customRange?.from ?? today;

  const customLabel = customRange?.from
    ? customRange.to
      ? `${format(customRange.from, "dd/MM/yyyy", { locale: ptBR })} → ${format(customRange.to, "dd/MM/yyyy", { locale: ptBR })}`
      : format(customRange.from, "dd/MM/yyyy", { locale: ptBR })
    : "Personalizado";

  const { ranked, team } = useMemo(
    () => computeRanking(rows, period, { start: customStart, end: customEnd }),
    [rows, period, customStart, customEnd],
  );

  const breakdown = useMemo(() => {
    if (!selectedAtivador) return null;
    const { start, end } = getRanges(period, { start: customStart, end: customEnd });
    const inCur = (d: Date | null) => !!d && d >= start && d < end;
    const norm = selectedAtivador.trim().toLowerCase();
    const mine = rows.filter((r) => (r.agente_ativacao ?? "").trim().toLowerCase() === norm);
    const ativados = mine.filter((r) => inCur(parseActivationDate(r.data_ativacao)));
    const criados = mine.filter((r) => inCur(parseDate(r.data_criacao)));
    const churns = mine.filter((r) => isChurnRow(r) && inCur(parseDate(r.data_fechamento)));
    return { ativados, criados, churns, start, end };
  }, [selectedAtivador, rows, period, customStart, customEnd]);

  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  const isTv = variant === "tv";
  const { getAvatar } = useAgentAvatars();
  const { getMedalCounts } = usePodiumMedals();

  return (
    <div className={cn(
      "rounded-2xl border border-border bg-card shadow-sm-soft",
      isTv ? "p-6" : "p-4 sm:p-6",
    )}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className={cn("font-display font-semibold text-secondary", isTv ? "text-2xl" : "text-lg")}>
              Ranking de metas
            </h2>
            <p className="font-small text-xs text-muted-foreground">
              Top 3 do período · Score = (60×%MRR + 30×%Clientes + penalidade de churn) / 100
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
            {(["semana", "mes", "trimestre"] as PeriodKey[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setPeriod(k)}
                className={cn(
                  "rounded-md px-3 py-1.5 font-subtitle text-xs transition",
                  period === k
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {PERIOD_LABELS[k]}
              </button>
            ))}
          </div>
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "h-8 gap-1.5 rounded-md font-subtitle text-xs font-semibold",
                  period === "custom"
                    ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                    : "text-muted-foreground",
                )}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {period === "custom" ? customLabel : "Personalizado"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                numberOfMonths={2}
                selected={customRange}
                onSelect={(range) => {
                  setCustomRange(range);
                  if (range?.from) setPeriod("custom");
                  if (range?.from && range?.to) setPickerOpen(false);
                }}
                locale={ptBR}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
              {period === "custom" && (
                <div className="flex items-center justify-end gap-2 border-t border-border p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => {
                      setCustomRange({ from: firstOfMonth, to: today });
                      setPeriod("mes");
                      setPickerOpen(false);
                    }}
                  >
                    <X className="h-3 w-3" />
                    Limpar
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>


      {ranked.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center font-subtitle text-sm text-muted-foreground">
          Sem dados suficientes para o período selecionado.
        </div>
      ) : (
        <>
          {isTv ? (
            <PodiumTv top3={top3} getAvatar={getAvatar} getMedalCounts={getMedalCounts} onSelect={setSelectedAtivador} />
          ) : (
          <div className={cn("grid gap-3", top3.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
            {top3.map((r, i) => {
              const m = MEDAL_STYLES[i];
              const isFirst = i === 0;
              return (
                <button
                  type="button"
                  key={r.ativador}
                  onClick={() => setSelectedAtivador(r.ativador)}
                  className={cn(
                    "relative overflow-hidden rounded-xl bg-gradient-to-br p-4 ring-1 text-left transition hover:ring-2 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer",
                    m.bg, m.ring,
                    isFirst && "sm:scale-[1.02]",
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Medal className={cn("h-7 w-7", m.text)} />
                      <div>
                        <p className={cn("font-subtitle text-[10px] uppercase tracking-wider", m.text)}>{m.label}</p>
                        <p className="font-numeric text-xs text-muted-foreground tabular-nums">{i + 1}º lugar</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("font-numeric font-bold tabular-nums", isTv ? "text-3xl" : "text-2xl", m.text)}>
                        {Math.round(r.scoreFinal)}

                      </p>
                      <p className="font-small text-[10px] uppercase tracking-wider text-muted-foreground">Score</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap min-w-0">
                    <p className={cn("font-display font-semibold text-foreground truncate min-w-0", isTv ? "text-xl" : "text-base")}>
                      {r.ativador}
                    </p>
                    <MedalBadges ativador={r.ativador} size="sm" getMedalCounts={getMedalCounts} />
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="font-numeric text-sm font-semibold tabular-nums text-foreground">{r.pctMrr.toFixed(0)}%</p>
                      <p className="font-small text-[10px] text-muted-foreground">MRR</p>
                    </div>
                    <div>
                      <p className="font-numeric text-sm font-semibold tabular-nums text-foreground">{r.pctClientes.toFixed(0)}%</p>
                      <p className="font-small text-[10px] text-muted-foreground">Clientes</p>
                    </div>
                    <div>
                      <p className="font-numeric text-sm font-semibold tabular-nums text-foreground">{r.pctChurn.toFixed(0)}%</p>
                      <p className="font-small text-[10px] text-muted-foreground">Churn</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          )}

          {rest.length > 0 && (
            <div className="mt-4 divide-y divide-border rounded-xl border border-border">
              {rest.map((r, i) => (
                <button
                  type="button"
                  key={r.ativador}
                  onClick={() => setSelectedAtivador(r.ativador)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left transition hover:bg-muted/40 focus:bg-muted/40 focus:outline-none"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-wrap">
                    <span className="font-numeric text-sm font-bold tabular-nums text-muted-foreground w-6 shrink-0">
                      {i + 4}º
                    </span>
                    <span className="font-subtitle text-sm font-semibold text-foreground truncate">{r.ativador}</span>
                    <MedalBadges ativador={r.ativador} size="sm" getMedalCounts={getMedalCounts} />
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-numeric text-xs tabular-nums text-muted-foreground hidden sm:inline">
                      {fmtBRL(r.mrrAtivado)} · {r.clientesAtivados} Clientes
                    </span>
                    <span className="font-numeric text-sm font-bold tabular-nums text-foreground">
                      {Math.round(r.scoreFinal)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 rounded-xl border border-primary/40 bg-primary/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-small text-[10px] uppercase tracking-wider text-primary">Time · consolidado</p>
                <p className={cn("font-display font-semibold text-foreground", isTv ? "text-xl" : "text-base")}>
                  Score agregado do período
                </p>
              </div>
              <div className="text-right">
                <p className={cn("font-numeric font-bold tabular-nums text-primary", isTv ? "text-3xl" : "text-2xl")}>
                  {Math.round(team.scoreFinal)}
                </p>
                <p className="font-small text-[10px] uppercase tracking-wider text-muted-foreground">Score</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="font-numeric text-sm font-semibold tabular-nums text-foreground">{team.pctMrr.toFixed(0)}%</p>
                <p className="font-small text-[10px] text-muted-foreground">MRR</p>
              </div>
              <div>
                <p className="font-numeric text-sm font-semibold tabular-nums text-foreground">{team.pctClientes.toFixed(0)}%</p>
                <p className="font-small text-[10px] text-muted-foreground">Clientes</p>
              </div>
              <div>
                <p className="font-numeric text-sm font-semibold tabular-nums text-foreground">{team.pctChurn.toFixed(0)}%</p>
                <p className="font-small text-[10px] text-muted-foreground">Churn</p>
              </div>
            </div>
          </div>

        </>
      )}

      <Dialog open={!!selectedAtivador} onOpenChange={(o) => !o && setSelectedAtivador(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {selectedAtivador} · {PERIOD_LABELS[period]}
            </DialogTitle>
            <DialogDescription className="font-small">
              Detalhe dos deals do ativador no período selecionado.
            </DialogDescription>
          </DialogHeader>
          {breakdown && (
            <div className="space-y-5">
              {[
                { title: "MRR ativado", deals: breakdown.ativados, dateField: "data_ativacao" as const, dateLabel: "Ativação", accent: "text-emerald-500" },
                { title: "Clientes criados", deals: breakdown.criados, dateField: "data_criacao" as const, dateLabel: "Criação", accent: "text-primary" },
                { title: "Churns realizados", deals: breakdown.churns, dateField: "data_fechamento" as const, dateLabel: "Fechamento", accent: "text-destructive" },
              ].map((section) => {
                const total = section.deals.reduce((s, r) => s + toNum(r.mrr), 0);
                return (
                  <section key={section.title}>
                    <div className="mb-2 flex items-baseline justify-between">
                      <h3 className={cn("font-subtitle text-sm font-semibold", section.accent)}>
                        {section.title}
                      </h3>
                      <span className="font-numeric text-xs tabular-nums text-muted-foreground">
                        {section.deals.length} deals · {fmtBRL(total)}
                      </span>
                    </div>
                    {section.deals.length === 0 ? (
                      <p className="rounded-md border border-dashed border-border px-3 py-4 text-center font-small text-xs text-muted-foreground">
                        Nenhum registro no período.
                      </p>
                    ) : (
                      <div className="divide-y divide-border rounded-md border border-border">
                        {section.deals
                          .slice()
                          .sort((a, b) => toNum(b.mrr) - toNum(a.mrr))
                          .map((d) => (
                            <div key={`${section.title}-${d.id_deal}`} className="flex items-center justify-between gap-3 px-3 py-2">
                              <div className="min-w-0">
                                <DealLink id={d.id_deal} className="font-subtitle text-sm font-medium text-foreground truncate block">
                                  {d.nome_negocio ?? `Deal ${d.id_deal}`}
                                </DealLink>
                                <p className="font-small text-[11px] text-muted-foreground">
                                  {section.dateLabel}: {d[section.dateField] ?? "—"}
                                </p>
                              </div>
                              <span className="font-numeric text-sm font-semibold tabular-nums text-foreground whitespace-nowrap">
                                {fmtBRL(toNum(d.mrr))}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ---------- Pódium TV ----------
interface PodiumTvProps {
  top3: ScoreRow[];
  getAvatar: (name: string) => { avatarUrl: string | null; fullName: string | null };
  onSelect: (ativador: string) => void;
}

const AvatarOrPlaceholder = ({
  url,
  ringClass,
  sizeClass,
}: {
  url: string | null;
  ringClass: string;
  sizeClass: string;
}) => {
  const [errored, setErrored] = useState(false);
  const showImg = url && !errored;
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-full bg-muted ring-4 ring-offset-2 ring-offset-card",
        ringClass,
        sizeClass,
      )}
    >
      {showImg ? (
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <User className="h-1/2 w-1/2 text-muted-foreground" strokeWidth={1.5} />
      )}
    </div>
  );
};

const PodiumTv = ({ top3, getAvatar, onSelect }: PodiumTvProps) => {
  // Order: 2nd left, 1st center, 3rd right
  const order: { rank: 0 | 1 | 2 }[] = [{ rank: 1 }, { rank: 0 }, { rank: 2 }];

  const pedestalHeight = (rank: number) =>
    rank === 0 ? "h-44" : rank === 1 ? "h-32" : "h-24";
  const avatarSize = (rank: number) =>
    rank === 0 ? "h-40 w-40" : "h-32 w-32";

  return (
    <div className="grid grid-cols-3 items-end gap-4 pt-8">
      {order.map(({ rank }) => {
        const r = top3[rank];
        if (!r) return <div key={rank} />;
        const m = MEDAL_STYLES[rank];
        const { avatarUrl } = getAvatar(r.ativador);
        return (
          <button
            key={r.ativador}
            type="button"
            onClick={() => onSelect(r.ativador)}
            className="group flex flex-col items-center focus:outline-none"
          >
            {/* Avatar + badge */}
            <div className="relative mb-3 transition group-hover:-translate-y-1">
              <AvatarOrPlaceholder
                url={avatarUrl}
                ringClass={m.ring}
                sizeClass={avatarSize(rank)}
              />
              <div
                className={cn(
                  "absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card px-3 py-0.5 font-numeric text-sm font-bold tabular-nums shadow-sm",
                  m.text,
                )}
              >
                {rank + 1}º
              </div>
            </div>
            <p className="mb-2 max-w-full truncate px-2 font-display text-lg font-semibold text-foreground">
              {r.ativador}
            </p>
            {/* Pedestal */}
            <div
              className={cn(
                "flex w-full flex-col items-center justify-start gap-2 rounded-t-xl bg-gradient-to-br p-3 ring-1 transition group-hover:ring-2",
                m.bg,
                m.ring,
                pedestalHeight(rank),
              )}
            >
              <div className="text-center">
                <p
                  className={cn(
                    "font-numeric font-bold tabular-nums leading-none",
                    rank === 0 ? "text-5xl" : "text-4xl",
                    m.text,
                  )}
                >
                  {Math.round(r.scoreFinal)}
                </p>
                <p className="mt-1 font-small text-[10px] uppercase tracking-wider text-muted-foreground">
                  Score
                </p>
              </div>
              <div className="mt-auto grid w-full grid-cols-3 gap-1 text-center">
                <div>
                  <p className="font-numeric text-xs font-semibold tabular-nums text-foreground">
                    {r.pctMrr.toFixed(0)}%
                  </p>
                  <p className="font-small text-[9px] text-muted-foreground">MRR</p>
                </div>
                <div>
                  <p className="font-numeric text-xs font-semibold tabular-nums text-foreground">
                    {r.pctClientes.toFixed(0)}%
                  </p>
                  <p className="font-small text-[9px] text-muted-foreground">Clientes</p>
                </div>
                <div>
                  <p className="font-numeric text-xs font-semibold tabular-nums text-foreground">
                    {r.pctChurn.toFixed(0)}%
                  </p>
                  <p className="font-small text-[9px] text-muted-foreground">Churn</p>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

