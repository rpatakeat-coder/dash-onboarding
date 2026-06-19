import { useEffect, useMemo, useState } from "react";
import { TrendingDown, RefreshCw, Users, AlertTriangle, DollarSign, UserCheck, Building2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { edgeErrorMessage } from "@/lib/edgeError";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtBRL, fmtPct, grupoPerfil, type DashSucessoRow } from "@/hooks/useDashSucesso";
import { cn } from "@/lib/utils";
import { hubspotDealUrl } from "@/lib/hubspot";
import { SucessoClientesModal } from "@/components/sucesso/SucessoClientesModal";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  loadChurnAjustes,
  saveChurnAjustes,
  periodoKey,
  ZERO_AJUSTE,
  type ChurnAjuste,
  type ChurnAjustesMap,
} from "@/lib/churnAjustes";

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

// data_fechamento vem como string BR "DD/MM/YYYY HH:MM:SS" (não ISO).
// Casa pelo mês/ano selecionado, equivalente ao SQL LIKE '%/MM/YYYY %'.
const matchPeriodoFechamento = (s: string | null | undefined, month0: number, year: number): boolean => {
  if (!s) return false;
  const str = s.trim();
  const mm = String(month0 + 1).padStart(2, "0");
  if (str.includes("/")) return str.includes(`/${mm}/${year}`);
  // Fallback p/ eventual formato ISO
  const d = new Date(str);
  return !Number.isNaN(d.getTime()) && d.getMonth() === month0 && d.getFullYear() === year;
};

// Exibe a data de fechamento (mantém DD/MM/YYYY se já for BR).
const fmtFechado = (s: string | null | undefined): string => {
  if (!s) return "—";
  const str = s.trim();
  if (str.includes("/")) return str.split(" ")[0];
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
};

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const PAGE_SIZE_OPTS = [25, 50, 75, 100] as const;

export const ChurnSucesso = ({ rows, qtdPMTotal, qtdGGGTotal, mrrPMTotal, mrrGGGTotal }: Props) => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11

  // Filtros locais da seção (additivos ao filtro global e ao seletor de mês).
  const [perfilSel, setPerfilSel] = useState<"P+M" | "G+GG" | null>(null);
  const [agenteSel, setAgenteSel] = useState<string | null>(null);
  // Modal de lista (padrão Onboarding) acionado pelos KPIs de churn.
  const [listOpen, setListOpen] = useState(false);
  // Paginação da lista detalhada (25 por padrão; até 100).
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTS[0]);

  // Inputs manuais (Upsell/Downsell/Reativações) por mês/ano — persistidos no Supabase (app_settings).
  const { user } = useAuth();
  const [ajustesMap, setAjustesMap] = useState<ChurnAjustesMap>({});
  const [ajustes, setAjustes] = useState<ChurnAjuste>(ZERO_AJUSTE); // valores em edição do período atual
  const [ajustesSaving, setAjustesSaving] = useState(false);

  // Carrega o mapa completo de ajustes uma vez.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const map = await loadChurnAjustes();
        if (alive) setAjustesMap(map);
      } catch (e) {
        if (alive) toast.error("Erro ao carregar ajustes de churn", { description: (e as Error).message });
      }
    })();
    return () => { alive = false; };
  }, []);

  // Espelha o período selecionado nos inputs (cada mês/ano guarda seus próprios valores).
  useEffect(() => {
    setAjustes(ajustesMap[periodoKey(year, month)] ?? ZERO_AJUSTE);
  }, [ajustesMap, year, month]);

  // Edição ao vivo (recalcula o churn líquido na hora).
  const setAjusteField = (k: keyof ChurnAjuste) => (v: number) =>
    setAjustes((cur) => ({ ...cur, [k]: v }));

  // Persiste no Supabase ao sair do campo (onBlur), só se algo mudou no período.
  const persistAjustes = async () => {
    const key = periodoKey(year, month);
    const atual = ajustesMap[key] ?? ZERO_AJUSTE;
    if (
      atual.upsell === ajustes.upsell &&
      atual.downsell === ajustes.downsell &&
      atual.reativacoes === ajustes.reativacoes
    ) return;
    const nextMap = { ...ajustesMap, [key]: ajustes };
    setAjustesSaving(true);
    try {
      await saveChurnAjustes(nextMap, user?.id ?? null);
      setAjustesMap(nextMap);
    } catch (e) {
      toast.error("Erro ao salvar ajustes de churn", { description: (e as Error).message });
    } finally {
      setAjustesSaving(false);
    }
  };

  const { upsell, downsell, reativacoes } = ajustes;

  // MRR base do mês via edge function (mesmo padrão do ChurnKpis)
  const [mrrBaseByMonth, setMrrBaseByMonth] = useState<(number | null)[]>(() => Array(12).fill(null));
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const fetchSheet = async () => {
    setSheetLoading(true);
    setSheetError(null);
    try {
      const { data, error } = await supabase.functions.invoke("churn-real-sheet");
      if (error || (data as { error?: string })?.error) throw new Error(await edgeErrorMessage(error, data));
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

  // Churn do Sucesso (regra do negócio, equivalente ao SQL):
  //   etapa_negocio = 'Churn' AND etapa_de_cancelamento = 'Sucesso'
  //   AND data_fechamento no mês/ano selecionado (string BR DD/MM/YYYY).
  // COUNT(*) — sem deduplicar (conta todas as linhas que batem).
  const churnRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          norm(r.etapa_negocio) === "churn" &&
          norm(r.etapa_de_cancelamento) === "sucesso" &&
          matchPeriodoFechamento(r.data_fechamento, month, year),
      ),
    [rows, year, month],
  );

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

  // Ordena por MRR e pagina a lista detalhada.
  const filteredSorted = useMemo(
    () => [...filteredRows].sort((a, b) => num(b.mrr) - num(a.mrr)),
    [filteredRows],
  );
  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize));
  const pageSafe = Math.min(page, totalPages - 1);
  const pageRows = filteredSorted.slice(pageSafe * pageSize, (pageSafe + 1) * pageSize);
  // Volta à 1ª página quando o conjunto muda (mês/ano/filtros locais).
  useEffect(() => { setPage(0); }, [filteredSorted]);

  // Ranking por agente — base é o recorte por perfil (sem o filtro de agente, para o usuário continuar vendo todos).
  const rankingBaseRows = useMemo(
    () => churnRows.filter((r) => !perfilSel || grupoPerfil(r.perfil_cliente) === perfilSel),
    [churnRows, perfilSel],
  );
  const ranking = useMemo(() => {
    const map = new Map<string, { agente: string; qtd: number; mrr: number }>();
    for (const r of rankingBaseRows) {
      const a = r.agente_sucesso?.trim() || "Sem responsável";
      const cur = map.get(a) ?? { agente: a, qtd: 0, mrr: 0 };
      cur.qtd++;
      cur.mrr += num(r.mrr);
      map.set(a, cur);
    }
    const totalMrr = rankingBaseRows.reduce((s, r) => s + num(r.mrr), 0);
    return Array.from(map.values())
      .map((c) => ({
        agente: c.agente,
        qtd: c.qtd,
        mrr: c.mrr,
        pctRep: totalMrr > 0 ? (c.mrr / totalMrr) * 100 : 0,
      }))
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
              Deals na etapa <strong>Churn</strong> com cancelamento do <strong>Sucesso</strong> — por <strong>data de fechamento</strong>
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
          onClick={() => setListOpen(true)}
          className="text-left rounded-2xl transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          title="Ver lista de churn do mês"
        >
          <KpiCard
            label="Churn de MRR (bruto)"
            value={fmtBRL(stats.mrr)}
            icon={DollarSign}
            tone="warning"
            hint={`${fmtN(stats.qtd)} deal${stats.qtd === 1 ? "" : "s"} fechado${stats.qtd === 1 ? "" : "s"} no mês · clique para ver a lista`}
          />
        </button>
        <button
          type="button"
          onClick={() => setListOpen(true)}
          className="text-left rounded-2xl transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          title="Ver lista de churn do mês"
        >
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
        </button>
      </div>

      {/* Ajustes manuais + Churn líquido */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm-soft sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-secondary">
              Churn líquido (ajuste manual)
            </h3>
            <p className="font-small text-xs text-muted-foreground">
              Líquido = Churn bruto − Upsell + Downsell − Reativações. Os valores são por mês/ano e ficam salvos para todos (Supabase).
            </p>
          </div>
          {ajustesSaving && (
            <span className="inline-flex items-center gap-1.5 font-subtitle text-[11px] text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" /> salvando…
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ManualField label="Upsell (R$)" value={upsell} onChange={setAjusteField("upsell")} onBlur={persistAjustes} />
          <ManualField label="Downsell (R$)" value={downsell} onChange={setAjusteField("downsell")} onBlur={persistAjustes} />
          <ManualField label="Reativações (R$)" value={reativacoes} onChange={setAjusteField("reativacoes")} onBlur={persistAjustes} />
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
                  </tr>
                );
              })}
              {!ranking.length && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
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
                <th className="px-3 py-2 text-right">MRR</th>
                <th className="px-3 py-2 text-right">Fechado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows
                .map((r) => (
                  <tr key={r.id_deal ?? r.asaas_id ?? r.nome_negocio} className="hover:bg-muted/30">
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
                    <td className="px-3 py-2.5 text-muted-foreground">{r.agente_sucesso?.trim() || "Sem responsável"}</td>
                    <td className="px-3 py-2.5 text-right font-numeric font-semibold">{fmtBRL(num(r.mrr))}</td>
                    <td className="px-3 py-2.5 text-right font-numeric text-muted-foreground">
                      {fmtFechado(r.data_fechamento)}
                    </td>
                  </tr>
                ))}
              {!filteredRows.length && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Nenhum deal corresponde aos filtros desta seção.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredSorted.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 font-subtitle text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>
                {`${pageSafe * pageSize + 1}–${Math.min(filteredSorted.length, (pageSafe + 1) * pageSize)} de ${fmtN(filteredSorted.length)}`}
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
        open={listOpen}
        onOpenChange={setListOpen}
        title={`Churn · ${MONTHS_PT[month]}/${year}`}
        rows={churnRows}
        showFechado
      />
    </section>
  );
};

// ---------- Helpers ----------

const ManualField = ({
  label, value, onChange, onBlur,
}: { label: string; value: number; onChange: (n: number) => void; onBlur?: () => void }) => (
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
      onBlur={onBlur}
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
