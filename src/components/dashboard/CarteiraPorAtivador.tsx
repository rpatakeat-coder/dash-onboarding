import { useMemo, useState } from "react";
import { AlertTriangle, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashRow } from "@/hooks/useDashOperacoes";
import { MultiSelectFilter } from "./MultiSelectFilter";
import { cn } from "@/lib/utils";

interface Props {
  rows: DashRow[];
}

const SEM_RESP = "Sem responsável";

export const CarteiraPorAtivador = ({ rows }: Props) => {
  const [etapasExcluidas, setEtapasExcluidas] = useState<Set<string>>(new Set());

  const { etapaOpts, etapaCounts } = useMemo(() => {
    const c = new Map<string, number>();
    for (const r of rows) {
      const k = r.etapa_negocio?.trim() || "Sem etapa";
      if (/^\d+$/.test(k)) continue;
      c.set(k, (c.get(k) ?? 0) + 1);
    }
    return {
      etapaOpts: [...c.keys()],
      etapaCounts: Object.fromEntries(c),
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (etapasExcluidas.size === 0) return rows;
    return rows.filter((r) => {
      const e = r.etapa_negocio?.trim() || "Sem etapa";
      return !etapasExcluidas.has(e);
    });
  }, [rows, etapasExcluidas]);

  const lista = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filteredRows) {
      const k = r.agente_ativacao?.trim() || SEM_RESP;
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([nome, count]) => ({ nome, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredRows]);

  const total = filteredRows.length;
  const semRespCount = lista.find((l) => l.nome === SEM_RESP)?.count ?? 0;
  const chartHeight = Math.max(180, lista.length * 36 + 20);

  // Para o select reutilizamos o MultiSelectFilter como "fases excluídas"
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm-soft">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-secondary">
            Carteira por ativador
          </h2>
          <p className="font-small text-xs text-muted-foreground">
            {lista.length} ativador(es) · {total.toLocaleString("pt-BR")} clientes
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
          <Users className="h-5 w-5 shrink-0 text-primary/70" />
        </div>
      </div>

      {semRespCount > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          <p className="font-subtitle text-xs text-foreground">
            <span className="font-bold">{semRespCount}</span>{" "}
            {semRespCount === 1 ? "deal está" : "deals estão"} sem ativador responsável.
          </p>
        </div>
      )}

      {lista.length === 0 ? (
        <p className="font-small text-sm text-muted-foreground">Sem dados.</p>
      ) : (
        <div className="w-full" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={lista}
              layout="vertical"
              margin={{ top: 4, right: 36, left: 8, bottom: 4 }}
              barCategoryGap={6}
            >
              <XAxis
                type="number"
                hide
                domain={[0, (max: number) => Math.ceil(max * 1.08)]}
              />
              <YAxis
                type="category"
                dataKey="nome"
                width={150}
                tick={{
                  fill: "hsl(var(--foreground))",
                  fontSize: 12,
                  fontWeight: 500,
                }}
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
                formatter={(value: number) => [`${value} clientes`, "Carteira"]}
                labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
              />
              <Bar
                dataKey="count"
                radius={[4, 4, 4, 4]}
                label={{
                  position: "right",
                  fill: "hsl(var(--foreground))",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {lista.map((entry) => (
                  <Cell
                    key={entry.nome}
                    fill={
                      entry.nome === SEM_RESP
                        ? "hsl(var(--warning))"
                        : "hsl(var(--primary))"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
};
