import { useMemo, useState } from "react";
import {
  TrendingDown,
  Users,
  DollarSign,
  UserCheck,
  Building2,
  ListChecks,
  User as UserIcon,
  ExternalLink,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import {
  useDashSucesso,
  fmtBRL,
  fmtPct,
  grupoPerfil,
  type DashSucessoRow,
} from "@/hooks/useDashSucesso";
import { hubspotDealUrl } from "@/lib/hubspot";

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const num = (v: unknown): number => {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

// data_fechamento é string BR "DD/MM/YYYY HH:MM:SS". Casa pelo mês/ano (LIKE '%/MM/YYYY %').
const matchPeriodo = (s: string | null | undefined, month0: number, year: number): boolean => {
  if (!s) return false;
  const str = s.trim();
  const mm = String(month0 + 1).padStart(2, "0");
  if (str.includes("/")) return str.includes(`/${mm}/${year}`);
  const d = new Date(str);
  return !Number.isNaN(d.getTime()) && d.getMonth() === month0 && d.getFullYear() === year;
};
const fmtFechado = (s: string | null | undefined): string => {
  if (!s) return "—";
  const str = s.trim();
  if (str.includes("/")) return str.split(" ")[0];
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
};

interface ChurnStats {
  qtd: number;
  mrr: number;
  qtdPM: number;
  qtdGGG: number;
  mrrPM: number;
  mrrGGG: number;
}
const computeStats = (rows: DashSucessoRow[]): ChurnStats => {
  let qtd = 0, mrr = 0, qtdPM = 0, qtdGGG = 0, mrrPM = 0, mrrGGG = 0;
  for (const r of rows) {
    const m = num(r.mrr);
    qtd++; mrr += m;
    const g = grupoPerfil(r.perfil_cliente);
    if (g === "P+M") { qtdPM++; mrrPM += m; }
    else if (g === "G+GG") { qtdGGG++; mrrGGG += m; }
  }
  return { qtd, mrr, qtdPM, qtdGGG, mrrPM, mrrGGG };
};

// ---- Subcomponentes ----
const ClientesTable = ({ rows }: { rows: DashSucessoRow[] }) => {
  const sorted = useMemo(() => [...rows].sort((a, b) => num(b.mrr) - num(a.mrr)), [rows]);
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[640px] text-sm">
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
          {sorted.map((r, i) => (
            <tr key={`${r.id_deal}-${i}`} className="hover:bg-muted/30">
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
              <td className="px-3 py-2.5 text-right font-numeric font-semibold tabular-nums">{fmtBRL(num(r.mrr))}</td>
              <td className="px-3 py-2.5 text-right font-numeric tabular-nums text-muted-foreground">{fmtFechado(r.data_fechamento)}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Nenhum churn no período.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const StatCards = ({ stats }: { stats: ChurnStats }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <KpiCard label="Churn no período" value={stats.qtd.toLocaleString("pt-BR")} icon={TrendingDown} tone="warning" hint="deals fechados em Churn (Sucesso)" />
    <KpiCard label="MRR perdido" value={fmtBRL(stats.mrr)} icon={DollarSign} tone="warning" hint="soma do MRR dos churns" />
    <KpiCard label="P+M" value={`${stats.qtdPM.toLocaleString("pt-BR")} · ${fmtBRL(stats.mrrPM)}`} icon={UserCheck} tone="secondary" hint={`${fmtPct(pct(stats.qtdPM, stats.qtd), 1)} dos churns`} />
    <KpiCard label="G+GG" value={`${stats.qtdGGG.toLocaleString("pt-BR")} · ${fmtBRL(stats.mrrGGG)}`} icon={Building2} tone="primary" hint={`${fmtPct(pct(stats.qtdGGG, stats.qtd), 1)} dos churns`} />
  </div>
);

export default function SucessoChurn() {
  const { fullName, agenteAtivacao } = useAuth();
  const myAgente = (agenteAtivacao ?? fullName ?? "").trim();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11

  const { rowsRaw, isLoading } = useDashSucesso(useMemo(() => ({}), []));

  // Churn do período (etapa Churn) já recortado por data_fechamento.
  const churnPeriodo = useMemo(
    () => rowsRaw.filter((r) => norm(r.etapa_negocio) === "churn" && matchPeriodo(r.data_fechamento, month, year)),
    [rowsRaw, month, year],
  );
  // Regra "Só Sucesso" (Visão Geral / MRR / Meu Desempenho).
  const churnSucesso = useMemo(
    () => churnPeriodo.filter((r) => norm(r.etapa_de_cancelamento) === "sucesso"),
    [churnPeriodo],
  );
  // Meu Desempenho: churn (Sucesso) do agente logado.
  const meusChurns = useMemo(
    () => churnSucesso.filter((r) => norm(r.agente_sucesso) === norm(myAgente)),
    [churnSucesso, myAgente],
  );

  const statsGeral = useMemo(() => computeStats(churnSucesso), [churnSucesso]);
  const statsMeu = useMemo(() => computeStats(meusChurns), [meusChurns]);

  // Motivos: TODO churn do período agrupado por etapa_de_cancelamento.
  const motivos = useMemo(() => {
    const map = new Map<string, { motivo: string; qtd: number; mrr: number }>();
    for (const r of churnPeriodo) {
      const motivo = r.etapa_de_cancelamento?.trim() || "Sem motivo";
      const cur = map.get(motivo) ?? { motivo, qtd: 0, mrr: 0 };
      cur.qtd++;
      cur.mrr += num(r.mrr);
      map.set(motivo, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.qtd - a.qtd);
  }, [churnPeriodo]);
  const motivosTotalQtd = motivos.reduce((s, m) => s + m.qtd, 0);
  const motivosTotalMrr = motivos.reduce((s, m) => s + m.mrr, 0);

  const years = Array.from(new Set([now.getFullYear(), now.getFullYear() - 1, year])).sort((a, b) => b - a);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <p className="font-subtitle text-[10px] uppercase tracking-widest text-muted-foreground">Sucesso</p>
              <h1 className="font-display text-xl font-semibold text-secondary">
                Churn · {MONTHS_PT[month]} / {year}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
          </div>
        </div>

        <Tabs defaultValue="visao" className="w-full">
          <TabsList>
            <TabsTrigger value="visao" className="gap-1.5"><Users className="h-3.5 w-3.5" />Visão Geral</TabsTrigger>
            <TabsTrigger value="meu" className="gap-1.5"><UserIcon className="h-3.5 w-3.5" />Meu Desempenho</TabsTrigger>
            <TabsTrigger value="motivos" className="gap-1.5"><ListChecks className="h-3.5 w-3.5" />Motivos</TabsTrigger>
            <TabsTrigger value="mrr" className="gap-1.5"><DollarSign className="h-3.5 w-3.5" />MRR</TabsTrigger>
          </TabsList>

          {/* VISÃO GERAL */}
          <TabsContent value="visao" className="mt-4 space-y-4">
            <StatCards stats={statsGeral} />
            <ClientesTable rows={churnSucesso} />
          </TabsContent>

          {/* MEU DESEMPENHO */}
          <TabsContent value="meu" className="mt-4 space-y-4">
            {!myAgente ? (
              <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
                Seu usuário não está vinculado a um agente de Sucesso. Peça a um admin para definir seu agente no painel de Admin.
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                  Mostrando o churn de <strong className="text-foreground">{myAgente}</strong> ·{" "}
                  {statsMeu.qtd.toLocaleString("pt-BR")} de {statsGeral.qtd.toLocaleString("pt-BR")} churns do mês
                  ({fmtPct(pct(statsMeu.qtd, statsGeral.qtd), 1)}) · {fmtBRL(statsMeu.mrr)} de MRR perdido.
                </div>
                <StatCards stats={statsMeu} />
                <ClientesTable rows={meusChurns} />
              </>
            )}
          </TabsContent>

          {/* MOTIVOS */}
          <TabsContent value="motivos" className="mt-4 space-y-3">
            <p className="font-small text-xs text-muted-foreground">
              Todo o churn do período agrupado por <strong>motivo de cancelamento</strong> (etapa_de_cancelamento).
            </p>
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-muted/50">
                  <tr className="font-subtitle text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 text-left">Motivo</th>
                    <th className="px-3 py-2 text-right">Qtd</th>
                    <th className="px-3 py-2 text-right">% dos churns</th>
                    <th className="px-3 py-2 text-right">MRR perdido</th>
                    <th className="px-3 py-2 text-right">% do MRR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {motivos.map((m) => (
                    <tr key={m.motivo} className="hover:bg-muted/30">
                      <td className="px-3 py-2.5 font-medium text-foreground">{m.motivo}</td>
                      <td className="px-3 py-2.5 text-right font-numeric tabular-nums">{m.qtd.toLocaleString("pt-BR")}</td>
                      <td className="px-3 py-2.5 text-right font-numeric tabular-nums text-muted-foreground">{fmtPct(pct(m.qtd, motivosTotalQtd), 1)}</td>
                      <td className="px-3 py-2.5 text-right font-numeric font-semibold tabular-nums">{fmtBRL(m.mrr)}</td>
                      <td className="px-3 py-2.5 text-right font-numeric tabular-nums text-muted-foreground">{fmtPct(pct(m.mrr, motivosTotalMrr), 1)}</td>
                    </tr>
                  ))}
                  {motivos.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Nenhum churn no período.</td></tr>
                  )}
                </tbody>
                {motivos.length > 0 && (
                  <tfoot className="border-t border-border bg-muted/30 font-subtitle text-xs">
                    <tr>
                      <td className="px-3 py-2.5 font-semibold text-foreground">Total</td>
                      <td className="px-3 py-2.5 text-right font-numeric tabular-nums font-semibold">{motivosTotalQtd.toLocaleString("pt-BR")}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">100%</td>
                      <td className="px-3 py-2.5 text-right font-numeric tabular-nums font-semibold">{fmtBRL(motivosTotalMrr)}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">100%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </TabsContent>

          {/* MRR */}
          <TabsContent value="mrr" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard label="MRR perdido (total)" value={fmtBRL(statsGeral.mrr)} icon={DollarSign} tone="warning" hint={`${statsGeral.qtd.toLocaleString("pt-BR")} churns no mês`} />
              <KpiCard label="MRR perdido · P+M" value={fmtBRL(statsGeral.mrrPM)} icon={UserCheck} tone="secondary" hint={`${fmtPct(pct(statsGeral.mrrPM, statsGeral.mrr), 1)} do MRR perdido`} />
              <KpiCard label="MRR perdido · G+GG" value={fmtBRL(statsGeral.mrrGGG)} icon={Building2} tone="primary" hint={`${fmtPct(pct(statsGeral.mrrGGG, statsGeral.mrr), 1)} do MRR perdido`} />
            </div>
            <p className="font-small text-xs text-muted-foreground">Clientes do mês ordenados por MRR (maior → menor):</p>
            <ClientesTable rows={churnSucesso} />
          </TabsContent>
        </Tabs>

        {isLoading && (
          <p className="text-center text-sm text-muted-foreground">Carregando dados…</p>
        )}
      </main>
    </div>
  );
}
