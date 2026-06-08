import { useEffect, useMemo, useState } from "react";
import { TrendingDown, RefreshCw, Users, AlertTriangle, DollarSign, UserCheck, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtBRL, fmtPct, grupoPerfil, type DashSucessoRow } from "@/hooks/useDashSucesso";
import { cn } from "@/lib/utils";

interface Props {
  rows: DashSucessoRow[];
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
const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

const parseDate = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const ChurnSucesso = ({ rows, qtdPMTotal, qtdGGGTotal, mrrPMTotal, mrrGGGTotal }: Props) => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11

  // Filtros locais da seção (additivos ao filtro global e ao seletor de mês).
  const [perfilSel, setPerfilSel] = useState<"P+M" | "G+GG" | null>(null);
  const [agenteSel, setAgenteSel] = useState<string | null>(null);

  // Inputs manuais (planilha) — TODO: substituir inputs manuais por fonte de dados quando o processo for definido.
  const [upsell, setUpsell] = useState(0);
  const [downsell, setDownsell] = useState(0);
  const [reativacoes, setReativacoes] = useState(0);

  // MRR base do mês via edge function (mesmo padrão do ChurnKpis)
  const [mrrBaseByMonth, setMrrBaseByMonth] = useState<(number | null)[]>(() => Array(12).fill(null));
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const fetchSheet = async () => {
    setSheetLoading(true);
    setSheetError(null);
    try {
      const { data, error } = await supabase.functions.invoke("churn-real-sheet");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (Array.isArray(data?.mrrBaseByMonth)) {
        setMrrBaseByMonth(
          data.mrrBaseByMonth.map((v: unknown) => (typeof v === "number" ? v : null)),
        );
      }
    } catch (e) {
      setSheetError((e as Error).message);
    } finally {
      setSheetLoading(false);
    }
  };

  useEffect(() => { fetchSheet(); }, []);

  // Filtra deals do pipeline Sucesso que sejam churn/cancelamento E fecharam no mês selecionado
  const churnRows = useMemo(() => {
    return rows.filter((r) => {
      if (norm(r.pipeline_nome) !== "sucesso") return false;
      const isChurn = norm(r.etapa_negocio) === "churn" || !!(r.etapa_de_cancelamento?.trim());
      if (!isChurn) return false;
      const d = parseDate(r.data_fechamento);
      if (!d) return false;
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }, [rows, year, month]);

  const stats = useMemo(() => {
    let mrr = 0, qtdPM = 0, qtdGGG = 0, mrrPM = 0, mrrGGG = 0;
    for (const r of churnRows) {
      const m = num(r.mrr);
      mrr += m;
      const g = grupoPerfil(r.perfil_cliente);
      if (g === "P+M") { qtdPM++; mrrPM += m; }
      else if (g === "G+GG") { qtdGGG++; mrrGGG += m; }
    }
    return { qtd: churnRows.length, mrr, qtdPM, qtdGGG, mrrPM, mrrGGG };
  }, [churnRows]);

  const mrrBase = mrrBaseByMonth[month] ?? null;
  const pctChurn = mrrBase && mrrBase > 0 ? (stats.mrr / mrrBase) * 100 : null;

  const churnLiquido = stats.mrr - upsell + downsell - reativacoes;
  const pctChurnLiq = mrrBase && mrrBase > 0 ? (churnLiquido / mrrBase) * 100 : null;

  // Aplica filtros locais (perfilGrupo + agente) sobre os churns do mês.
  const filteredRows = useMemo(() => {
    return churnRows.filter((r) => {
      if (perfilSel && grupoPerfil(r.perfil_cliente) !== perfilSel) return false;
      if (agenteSel) {
        const a = r.agente_sucesso?.trim() || "Sem responsável";
        if (a !== agenteSel) return false;
      }
      return true;
    });
  }, [churnRows, perfilSel, agenteSel]);

  // Ranking por agente — base é o recorte por perfil (sem o filtro de agente, para o usuário continuar vendo todos).
  const rankingBaseRows = useMemo(
    () => churnRows.filter((r) => !perfilSel || grupoPerfil(r.perfil_cliente) === perfilSel),
    [churnRows, perfilSel],
  );
  const ranking = useMemo(() => {
    const map = new Map<string, { agente: string; qtd: number; mrr: number; motivos: Map<string, number> }>();
    for (const r of rankingBaseRows) {
      const a = r.agente_sucesso?.trim() || "Sem responsável";
      const cur = map.get(a) ?? { agente: a, qtd: 0, mrr: 0, motivos: new Map() };
      cur.qtd++;
      cur.mrr += num(r.mrr);
      const mot = r.etapa_de_cancelamento?.trim();
      if (mot) cur.motivos.set(mot, (cur.motivos.get(mot) ?? 0) + 1);
      map.set(a, cur);
    }
    const totalMrr = rankingBaseRows.reduce((s, r) => s + num(r.mrr), 0);
    return Array.from(map.values())
      .map((c) => {
        const top = Array.from(c.motivos.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
        return {
          agente: c.agente,
          qtd: c.qtd,
          mrr: c.mrr,
          pctRep: totalMrr > 0 ? (c.mrr / totalMrr) * 100 : 0,
          motivos: top.length ? top.map(([m, n]) => `${m} (${n})`).join(", ") : "—",
        };
      })
      .sort((a, b) => b.mrr - a.mrr);
  }, [rankingBaseRows]);

  const togglePerfil = (g: "P+M" | "G+GG") => {
    setPerfilSel((cur) => (cur === g ? null : g));
    setAgenteSel(null);
  };
  const toggleAgente = (a: string) => setAgenteSel((cur) => (cur === a ? null : a));
  const clearLocalFilters = () => { setPerfilSel(null); setAgenteSel(null); };
  const hasLocalFilter = perfilSel !== null || agenteSel !== null;

  const years = Array.from(new Set([now.getFullYear(), now.getFullYear() - 1, year])).sort((a, b) => b - a);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-secondary">
              Churn do Sucesso · {MONTHS_PT[month]} / {year}
            </h2>
            <p className="font-small text-xs text-muted-foreground">
              Deals em Churn ou com motivo de cancelamento — por <strong>data de fechamento</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS_PT.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="h-9 w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={fetchSheet}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 font-subtitle text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary"
            title="Atualizar MRR base da planilha"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", sheetLoading && "animate-spin")} />
            MRR base
          </button>
        </div>
      </div>

      {/* Chip de filtro ativo local */}
      {hasLocalFilter && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
            Filtros desta seção:
          </span>
          {perfilSel && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              Perfil: {perfilSel}
              <button onClick={() => setPerfilSel(null)} className="text-primary/70 hover:text-primary" aria-label="remover">✕</button>
            </span>
          )}
          {agenteSel && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              Agente: {agenteSel}
              <button onClick={() => setAgenteSel(null)} className="text-primary/70 hover:text-primary" aria-label="remover">✕</button>
            </span>
          )}
          <button
            onClick={clearLocalFilters}
            className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            limpar tudo
          </button>
        </div>
      )}

      {/* KPIs principais */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={clearLocalFilters}
          aria-pressed={!hasLocalFilter}
          className={cn(
            "text-left rounded-2xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            !hasLocalFilter ? "ring-1 ring-primary/20" : "hover:-translate-y-0.5",
          )}
          title={hasLocalFilter ? "Limpar filtros da seção" : "Sem filtro local ativo"}
        >
          <KpiCard
            label="Churn de MRR (bruto)"
            value={fmtBRL(stats.mrr)}
            icon={DollarSign}
            tone="warning"
            hint={`${fmtN(stats.qtd)} deal${stats.qtd === 1 ? "" : "s"} fechado${stats.qtd === 1 ? "" : "s"} no mês`}
          />
        </button>
        <KpiCard
          label="% de Churn"
          value={pctChurn !== null ? `${pctChurn.toFixed(2).replace(".", ",")}%` : sheetLoading ? "…" : "—"}
          icon={TrendingDown}
          tone="warning"
          hint={
            sheetError
              ? `Erro: ${sheetError}`
              : mrrBase !== null
              ? `${fmtBRL(stats.mrr)} ÷ ${fmtBRL(mrrBase)} (MRR início do mês)`
              : "Lendo MRR início do mês (Dados 2026)…"
          }
        />
      </div>

      {/* Ajustes manuais + Churn líquido */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm-soft sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-secondary">
              Churn líquido (ajuste manual)
            </h3>
            <p className="font-small text-xs text-muted-foreground">
              Líquido = Churn bruto − Upsell + Downsell − Reativações. Preencha os valores do mês a partir da planilha.
            </p>
          </div>
        </div>

        {/* TODO: substituir inputs manuais por fonte de dados quando o processo for definido. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ManualField label="Upsell (R$)" value={upsell} onChange={setUpsell} />
          <ManualField label="Downsell (R$)" value={downsell} onChange={setDownsell} />
          <ManualField label="Reativações (R$)" value={reativacoes} onChange={setReativacoes} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-background/50 p-4">
            <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              Churn líquido
            </p>
            <p className={cn(
              "mt-1 font-display text-2xl font-bold tabular-nums",
              churnLiquido > 0 ? "text-destructive" : "text-success",
            )}>
              {fmtBRL(churnLiquido)}
            </p>
            <p className="font-small text-xs text-muted-foreground">
              {fmtBRL(stats.mrr)} − {fmtBRL(upsell)} + {fmtBRL(downsell)} − {fmtBRL(reativacoes)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background/50 p-4">
            <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              % Churn líquido
            </p>
            <p className={cn(
              "mt-1 font-display text-2xl font-bold tabular-nums",
              (pctChurnLiq ?? 0) > 0 ? "text-destructive" : "text-success",
            )}>
              {pctChurnLiq !== null ? `${pctChurnLiq.toFixed(2).replace(".", ",")}%` : "—"}
            </p>
            <p className="font-small text-xs text-muted-foreground">
              {mrrBase !== null ? `Sobre MRR início do mês ${fmtBRL(mrrBase)}` : "Aguardando MRR base"}
            </p>
          </div>
        </div>
      </div>

      {/* Segmentação por perfil — clicáveis (toggle) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PerfilChurnCard
          label="Churn P+M"
          icon={UserCheck}
          qtd={stats.qtdPM}
          mrr={stats.mrrPM}
          qtdDen={qtdPMTotal}
          mrrDen={mrrPMTotal}
          tone="secondary"
          active={perfilSel === "P+M"}
          onClick={() => togglePerfil("P+M")}
        />
        <PerfilChurnCard
          label="Churn G+GG"
          icon={Building2}
          qtd={stats.qtdGGG}
          mrr={stats.mrrGGG}
          qtdDen={qtdGGGTotal}
          mrrDen={mrrGGGTotal}
          tone="primary"
          active={perfilSel === "G+GG"}
          onClick={() => togglePerfil("G+GG")}
        />
      </div>

      {/* Ranking por agente */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm-soft sm:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10">
            <Users className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-secondary">
              Ranking de churn por agente
            </h3>
            <p className="font-small text-xs text-muted-foreground">
              Clique numa linha para filtrar a lista detalhada abaixo.
              {perfilSel && <> Recorte atual: <strong>{perfilSel}</strong>.</>}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50">
              <tr className="font-subtitle text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Agente</th>
                <th className="px-3 py-2 text-right">Qtd churns</th>
                <th className="px-3 py-2 text-right">MRR perdido</th>
                <th className="px-3 py-2 text-right">% do churn</th>
                <th className="px-3 py-2 text-left">Principais motivos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ranking.map((r, i) => {
                const isActive = agenteSel === r.agente;
                return (
                  <tr
                    key={r.agente}
                    onClick={() => toggleAgente(r.agente)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleAgente(r.agente);
                      }
                    }}
                    aria-pressed={isActive}
                    className={cn(
                      "cursor-pointer transition",
                      isActive ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/30",
                    )}
                  >
                    <td className="px-3 py-2.5 font-numeric text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2.5 font-medium text-foreground">
                      {isActive && <span className="mr-1.5 text-primary">●</span>}
                      {r.agente}
                    </td>
                    <td className="px-3 py-2.5 text-right font-numeric">{fmtN(r.qtd)}</td>
                    <td className="px-3 py-2.5 text-right font-numeric font-semibold">{fmtBRL(r.mrr)}</td>
                    <td className="px-3 py-2.5 text-right font-numeric">{fmtPct(r.pctRep, 1)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.motivos}</td>
                  </tr>
                );
              })}
              {!ranking.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Nenhum churn no período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lista detalhada — filtrada pelos filtros locais (perfil + agente) */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm-soft sm:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-base font-semibold text-secondary">
              Lista detalhada
            </h3>
            <p className="font-small text-xs text-muted-foreground">
              {fmtN(filteredRows.length)} deal{filteredRows.length === 1 ? "" : "s"} ·{" "}
              {fmtBRL(filteredRows.reduce((s, r) => s + num(r.mrr), 0))} em MRR perdido
              {hasLocalFilter && " (filtrado)"}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50">
              <tr className="font-subtitle text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left">Perfil</th>
                <th className="px-3 py-2 text-left">Agente</th>
                <th className="px-3 py-2 text-left">Motivo</th>
                <th className="px-3 py-2 text-right">MRR</th>
                <th className="px-3 py-2 text-right">Fechado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRows
                .slice()
                .sort((a, b) => num(b.mrr) - num(a.mrr))
                .map((r) => (
                  <tr key={r.id_deal ?? r.asaas_id ?? r.nome_negocio} className="hover:bg-muted/30">
                    <td className="px-3 py-2.5 font-medium text-foreground">{r.nome_negocio ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.perfil_cliente ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.agente_sucesso?.trim() || "Sem responsável"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.etapa_de_cancelamento?.trim() || "—"}</td>
                    <td className="px-3 py-2.5 text-right font-numeric font-semibold">{fmtBRL(num(r.mrr))}</td>
                    <td className="px-3 py-2.5 text-right font-numeric text-muted-foreground">
                      {r.data_fechamento ? new Date(r.data_fechamento).toLocaleDateString("pt-BR") : "—"}
                    </td>
                  </tr>
                ))}
              {!filteredRows.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Nenhum deal corresponde aos filtros desta seção.
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

// ---------- Helpers ----------

const ManualField = ({
  label, value, onChange,
}: { label: string; value: number; onChange: (n: number) => void }) => (
  <label className="block">
    <span className="mb-1 block font-subtitle text-[11px] uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
    <Input
      type="number"
      min={0}
      step="0.01"
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(num(e.target.value))}
      className="h-9 font-numeric"
    />
  </label>
);

interface PerfilCardProps {
  label: string;
  icon: typeof AlertTriangle;
  qtd: number;
  mrr: number;
  qtdDen: number;
  mrrDen: number;
  tone: "primary" | "secondary" | "warning" | "success";
  active?: boolean;
  onClick?: () => void;
}
const toneMap: Record<PerfilCardProps["tone"], string> = {
  primary: "text-primary bg-primary/10",
  secondary: "text-secondary bg-secondary/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
};
const PerfilChurnCard = ({ label, icon: Icon, qtd, mrr, qtdDen, mrrDen, tone, active, onClick }: PerfilCardProps) => {
  const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!active}
      className={cn(
        "w-full text-left rounded-2xl border bg-card p-6 shadow-sm-soft transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        active ? "border-primary ring-2 ring-primary/40" : "border-border hover:-translate-y-0.5 hover:shadow-md-soft",
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-subtitle text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
          <div className="mt-3 space-y-3">
            <div>
              <p className="font-small text-[11px] uppercase tracking-wide text-muted-foreground">Clientes</p>
              <p className="font-numeric text-2xl font-bold text-foreground">
                {fmtN(qtd)}{" "}
                <span className="font-numeric text-sm font-semibold text-muted-foreground">
                  ({fmtPct(pct(qtd, qtdDen), 2)} do grupo)
                </span>
              </p>
            </div>
            <div>
              <p className="font-small text-[11px] uppercase tracking-wide text-muted-foreground">MRR perdido</p>
              <p className="font-numeric text-xl font-bold text-foreground">
                {fmtBRL(mrr)}{" "}
                <span className="font-numeric text-sm font-semibold text-muted-foreground">
                  ({fmtPct(pct(mrr, mrrDen), 2)} do grupo)
                </span>
              </p>
            </div>
          </div>
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", toneMap[tone])}>
          <Icon className="h-5 w-5" strokeWidth={2.25} />
        </div>
      </div>
    </button>
  );
};
