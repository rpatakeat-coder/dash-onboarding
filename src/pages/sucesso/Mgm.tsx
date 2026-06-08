import { useEffect, useMemo, useState } from "react";
import { Users2, AlertTriangle, TrendingUp, Target, Trophy } from "lucide-react";
import {
  BarChart,
  Bar,
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

// ============================================================================
// TODO: confirmar com o time como identificar registros "MGM" nestas tabelas.
// Hoje "Leads Criados Hubspot" e "Vendas Hubspot" NÃO possuem coluna de
// origem/fonte (ex.: origem, fonte, source, tag, campanha). Enquanto isso, o
// predicado abaixo retorna `false` — os gráficos ficam zerados e um aviso é
// exibido no topo da página. Quando a fonte for definida, ajustar APENAS este
// predicado (ex.: row.origem === 'MGM' ou row.source ILIKE '%mgm%').
// ============================================================================
type LeadRow = { id_deal: number | null; nome_deal: string | null; data_criacao: string | null; seller: string | null };
type VendaRow = { id_deal: number | null; nome_deal: string | null; created_at: string | null; mrr: string | null; seller: string | null; perfil: string | null };

const isMgmLead = (_r: LeadRow): boolean => false;       // TODO: ajustar quando houver fonte
const isMgmVenda = (_r: VendaRow): boolean => false;     // TODO: ajustar quando houver fonte
const MGM_FONTE_DEFINIDA = false; // alterar para true quando o predicado tiver lógica real

const MONTHS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

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

  const { leadsByMonth, vendasByMonth, totalLeads, totalConv, taxa } = useMemo(() => {
    const lArr = Array(12).fill(0);
    const vArr = Array(12).fill(0);
    let tl = 0, tc = 0;
    for (const r of leads) {
      if (!isMgmLead(r)) continue;
      const d = parseDate(r.data_criacao);
      if (!d || d.getFullYear() !== year) continue;
      lArr[d.getMonth()]++;
      tl++;
    }
    for (const r of vendas) {
      if (!isMgmVenda(r)) continue;
      const d = parseDate(r.created_at);
      if (!d || d.getFullYear() !== year) continue;
      vArr[d.getMonth()]++;
      tc++;
    }
    return {
      leadsByMonth: lArr.map((v, i) => ({ mes: MONTHS_PT[i], valor: v })),
      vendasByMonth: vArr.map((v, i) => ({ mes: MONTHS_PT[i], valor: v })),
      totalLeads: tl,
      totalConv: tc,
      taxa: tl > 0 ? (tc / tl) * 100 : 0,
    };
  }, [leads, vendas, year]);

  const years = Array.from(new Set([now.getFullYear(), now.getFullYear() - 1, year])).sort((a, b) => b - a);

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
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
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
                definirmos como distinguir um registro MGM dos demais. Me confirme qual campo usar e eu ajusto o
                filtro (<code>isMgmLead</code> / <code>isMgmVenda</code> em <code>src/pages/sucesso/Mgm.tsx</code>).
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
          <KpiCard
            label="MGM Leads (ano)"
            value={loading ? "…" : totalLeads.toLocaleString("pt-BR")}
            icon={TrendingUp}
            tone="primary"
            hint={`Soma de ${year}`}
          />
          <KpiCard
            label="MGM Convertidos (ano)"
            value={loading ? "…" : totalConv.toLocaleString("pt-BR")}
            icon={Trophy}
            tone="success"
            hint={`Soma de ${year}`}
          />
          <KpiCard
            label="Taxa de Conversão"
            value={loading ? "…" : `${taxa.toFixed(1).replace(".", ",")}%`}
            icon={Target}
            tone="secondary"
            hint={`${totalConv} ÷ ${totalLeads}`}
          />
        </div>

        <ChartCard title={`MGM Leads (Mês) · ${year}`} data={leadsByMonth} fill="hsl(var(--primary))" />
        <ChartCard title={`MGM Convertidos (Mês) · ${year}`} data={vendasByMonth} fill="hsl(var(--success))" />
      </main>
    </div>
  );
}

const ChartCard = ({
  title, data, fill,
}: { title: string; data: { mes: string; valor: number }[]; fill: string }) => (
  <div className="rounded-2xl border border-border bg-card p-4 shadow-sm-soft sm:p-6">
    <h2 className="mb-4 font-display text-base font-semibold text-secondary">{title}</h2>
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="valor" fill={fill} radius={[6, 6, 0, 0]}>
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
