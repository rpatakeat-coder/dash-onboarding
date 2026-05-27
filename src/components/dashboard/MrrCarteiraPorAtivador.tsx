import { useMemo, useState } from "react";
import { DollarSign } from "lucide-react";
import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtBRL, type DashRow } from "@/hooks/useDashOperacoes";
import { MultiSelectFilter } from "./MultiSelectFilter";

const SEM_RESP = "Sem responsável";

const toNum = (v: string | null | undefined) => {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

interface Props {
  rows: DashRow[];
}

export const MrrCarteiraPorAtivador = ({ rows }: Props) => {
  const [etapasExcluidas, setEtapasExcluidas] = useState<Set<string>>(new Set());

  const { etapaOpts, etapaCounts } = useMemo(() => {
    const c = new Map<string, number>();
    for (const r of rows) {
      const k = r.etapa_negocio?.trim() || "Sem etapa";
      if (/^\d+$/.test(k)) continue;
      c.set(k, (c.get(k) ?? 0) + 1);
    }
    return { etapaOpts: [...c.keys()], etapaCounts: Object.fromEntries(c) };
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (etapasExcluidas.size === 0) return rows;
    return rows.filter((r) => {
      const e = r.etapa_negocio?.trim() || "Sem etapa";
      return !etapasExcluidas.has(e);
    });
  }, [rows, etapasExcluidas]);

  const lista = useMemo(() => {
    const map = new Map<string, { mrr: number; count: number }>();
    for (const r of filteredRows) {
      const k = r.agente_ativacao?.trim() || SEM_RESP;
      const cur = map.get(k) ?? { mrr: 0, count: 0 };
      cur.mrr += toNum(r.mrr);
      cur.count += 1;
      map.set(k, cur);
    }
    return [...map.entries()]
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => b.mrr - a.mrr);
  }, [filteredRows]);

  const totalMrr = lista.reduce((s, l) => s + l.mrr, 0);
  const chartHeight = Math.max(180, lista.length * 36 + 20);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm-soft">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-secondary">
            MRR em gestão por ativador
          </h2>
          <p className="font-small text-xs text-muted-foreground">
            {lista.length} ativador(es) · {fmtBRL(totalMrr)} sob gestão
            {etapasExcluidas.size > 0 && (
              <span className="ml-1 text-warning">
                · {etapasExcluidas.size} fase(s) ocultada(s)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MultiSelectFilter
            label="Ocultar fase"
            options={etapaOpts}
            selected={etapasExcluidas}
            onChange={setEtapasExcluidas}
            counts={etapaCounts}
          />
          <DollarSign className="h-5 w-5 shrink-0 text-primary/70" />
        </div>
      </div>

      {lista.length === 0 ? (
        <p className="font-small text-sm text-muted-foreground">Sem dados.</p>
      ) : (
        <div className="w-full" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={lista}
              layout="vertical"
              margin={{ top: 4, right: 120, left: 8, bottom: 4 }}
              barCategoryGap={6}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="nome"
                width={150}
                tick={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number, _name, item) => {
                  const count = (item?.payload as { count?: number } | undefined)?.count ?? 0;
                  return [`${fmtBRL(value)} · ${count} cliente(s)`, "MRR em gestão"];
                }}
                labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
              />
              <Bar
                dataKey="mrr"
                name="MRR"
                fill="hsl(var(--primary))"
                radius={[0, 4, 4, 0]}
              >
                <LabelList
                  dataKey="mrr"
                  position="right"
                  formatter={(v: number) => fmtBRL(v)}
                  style={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 700 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
};
