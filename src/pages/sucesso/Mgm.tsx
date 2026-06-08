import { useEffect, useMemo, useState } from "react";
import { Users2, AlertTriangle, TrendingUp, Target, Trophy } from "lucide-react";
import {
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// ============================================================================
// TODO: confirmar com o time como identificar registros "MGM" nestas tabelas.
// ============================================================================
type LeadRow = { id_deal: number | null; nome_deal: string | null; data_criacao: string | null; seller: string | null };
type VendaRow = { id_deal: number | null; nome_deal: string | null; created_at: string | null; mrr: string | null; seller: string | null; perfil: string | null };

const isMgmLead = (_r: LeadRow): boolean => false;       // TODO
const isMgmVenda = (_r: VendaRow): boolean => false;     // TODO
const MGM_FONTE_DEFINIDA = false;

const MONTHS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MONTHS_PT_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const parseDate = (s: string | null): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const fetchAll = async <T,>(table: string): Promise<T[]> => {
  const pageSize = 1000;
  let from = 0;
  const all: T[] = [];
  while (true) {
    const { data, error } = await (supabase as any).from(table).select("*").range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
};

export default function SucessoMgm() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [vendas, setVendas] = useState<VendaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  // Recorte de mês (0-11) — null = ano inteiro. Compartilhado por cards e gráficos.
  const [mesSel, setMesSel] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [l, v] = await Promise.all([
          fetchAll<LeadRow>("Leads Criados Hubspot"),
          fetchAll<VendaRow>("Vendas Hubspot"),
        ]);
        setLeads(l);
        setVendas(v);
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Séries anuais (12 meses) — sempre renderizadas; o destaque do mês é visual.
  const { leadsByMonth, vendasByMonth } = useMemo(() => {
    const lArr = Array(12).fill(0);
    const vArr = Array(12).fill(0);
    for (const r of leads) {
      if (!isMgmLead(r)) continue;
      const d = parseDate(r.data_criacao);
      if (!d || d.getFullYear() !== year) continue;
      lArr[d.getMonth()]++;
    }
    for (const r of vendas) {
      if (!isMgmVenda(r)) continue;
      const d = parseDate(r.created_at);
      if (!d || d.getFullYear() !== year) continue;
      vArr[d.getMonth()]++;
    }
    return {
      leadsByMonth: lArr.map((v, i) => ({ mes: MONTHS_PT[i], idx: i, valor: v })),
      vendasByMonth: vArr.map((v, i) => ({ mes: MONTHS_PT[i], idx: i, valor: v })),
    };
  }, [leads, vendas, year]);

  // Totais respeitando o recorte (mês ou ano inteiro)
  const { totalLeads, totalConv, taxa } = useMemo(() => {
    const filt = (i: number) => (mesSel === null ? true : i === mesSel);
    const tl = leadsByMonth.reduce((s, x) => s + (filt(x.idx) ? x.valor : 0), 0);
    const tc = vendasByMonth.reduce((s, x) => s + (filt(x.idx) ? x.valor : 0), 0);
    return { totalLeads: tl, totalConv: tc, taxa: tl > 0 ? (tc / tl) * 100 : 0 };
  }, [leadsByMonth, vendasByMonth, mesSel]);

  const years = Array.from(new Set([now.getFullYear(), now.getFullYear() - 1, year])).sort((a, b) => b - a);
  const escopo = mesSel === null ? String(year) : `${MONTHS_PT_FULL[mesSel]}/${year}`;
  const toggleCard = () => setMesSel(null); // card clicado limpa o recorte

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-subtitle text-[10px] uppercase tracking-widest text-muted-foreground">
                Sucesso
              </p>
              <h1 className="font-display text-xl font-semibold text-secondary">
                MGM · Member Get Member
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mesSel !== null && (
              <button
                onClick={() => setMesSel(null)}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                Mês: <span className="text-foreground">{MONTHS_PT_FULL[mesSel]}</span> · limpar ✕
              </button>
            )}
            <select
              value={year}
              onChange={(e) => { setYear(Number(e.target.value)); setMesSel(null); }}
              className="h-9 rounded-lg border border-border bg-background px-3 font-subtitle text-xs"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {!MGM_FONTE_DEFINIDA && (
          <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/5 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div className="space-y-1">
              <p className="font-display text-sm font-semibold text-warning">
                Fonte do MGM ainda não definida
              </p>
              <p className="font-small text-xs text-muted-foreground">
                As tabelas <strong>Leads Criados Hubspot</strong> e <strong>Vendas Hubspot</strong> não possuem
                coluna de origem/fonte (ex.: <code>origem</code>, <code>source</code>, <code>tag</code>,{" "}
                <code>campanha</code>) que identifique registros MGM. Os gráficos abaixo estão zerados até
                definirmos como distinguir um registro MGM dos demais.
              </p>
            </div>
          </div>
        )}

        {err && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Erro ao carregar dados: {err}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { label: `MGM Leads (${escopo})`, value: loading ? "…" : totalLeads.toLocaleString("pt-BR"), icon: TrendingUp, tone: "primary" as const, hint: mesSel === null ? `Soma de ${year}` : `Total em ${MONTHS_PT_FULL[mesSel]}` },
            { label: `MGM Convertidos (${escopo})`, value: loading ? "…" : totalConv.toLocaleString("pt-BR"), icon: Trophy, tone: "success" as const, hint: mesSel === null ? `Soma de ${year}` : `Total em ${MONTHS_PT_FULL[mesSel]}` },
            { label: "Taxa de Conversão", value: loading ? "…" : `${taxa.toFixed(1).replace(".", ",")}%`, icon: Target, tone: "secondary" as const, hint: `${totalConv} ÷ ${totalLeads}` },
          ].map((k) => (
            <button
              key={k.label}
              type="button"
              onClick={toggleCard}
              disabled={mesSel === null}
              aria-pressed={mesSel === null}
              className={cn(
                "text-left rounded-2xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                mesSel === null ? "ring-1 ring-primary/20" : "hover:-translate-y-0.5",
              )}
              title={mesSel === null ? "Sem recorte de mês ativo" : "Limpar recorte de mês"}
            >
              <KpiCard label={k.label} value={k.value} icon={k.icon} tone={k.tone} hint={k.hint} />
            </button>
          ))}
        </div>

        <ChartCard
          title={`MGM Leads (Mês) · ${year}`}
          data={leadsByMonth}
          fill="hsl(var(--primary))"
          selectedIdx={mesSel}
          onSelect={(i) => setMesSel((cur) => (cur === i ? null : i))}
        />
        <ChartCard
          title={`MGM Convertidos (Mês) · ${year}`}
          data={vendasByMonth}
          fill="hsl(var(--success))"
          selectedIdx={mesSel}
          onSelect={(i) => setMesSel((cur) => (cur === i ? null : i))}
        />
      </main>
    </div>
  );
}

const ChartCard = ({
  title, data, fill, selectedIdx, onSelect,
}: {
  title: string;
  data: { mes: string; idx: number; valor: number }[];
  fill: string;
  selectedIdx: number | null;
  onSelect: (i: number) => void;
}) => (
  <div className="rounded-2xl border border-border bg-card p-4 shadow-sm-soft sm:p-6">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-display text-base font-semibold text-secondary">{title}</h2>
      <p className="font-small text-xs text-muted-foreground">
        Clique numa coluna para recortar; clique no card para limpar.
      </p>
    </div>
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar
            dataKey="valor"
            radius={[6, 6, 0, 0]}
            onClick={(d: any) => typeof d?.idx === "number" && onSelect(d.idx)}
            style={{ cursor: "pointer" }}
          >
            {data.map((d) => (
              <Cell
                key={d.idx}
                fill={fill}
                fillOpacity={selectedIdx === null || selectedIdx === d.idx ? 1 : 0.25}
                stroke={selectedIdx === d.idx ? "hsl(var(--primary))" : "transparent"}
                strokeWidth={selectedIdx === d.idx ? 2 : 0}
              />
            ))}
            <LabelList
              dataKey="valor"
              position="top"
              style={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);
