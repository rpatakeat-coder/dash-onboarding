import { useMemo, useState } from "react";
import { AlertTriangle, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashRow } from "@/hooks/useDashOperacoes";
import { MultiSelectFilter } from "./MultiSelectFilter";


interface Props {
  rows: DashRow[];
  etapasExcluidas: Set<string>;
  onEtapasExcluidasChange: (next: Set<string>) => void;
}

const SEM_RESP = "Sem responsável";

const PERFIL_COLORS: Record<string, string> = {
  P: "hsl(160 40% 65%)",   // verde suave
  M: "hsl(15 65% 72%)",    // coral suave
  G: "hsl(220 25% 75%)",   // azul-acinzentado suave
  GG: "hsl(38 70% 70%)",   // âmbar suave
  "—": "hsl(var(--muted-foreground) / 0.5)",
};
const PERFIL_FALLBACKS = [
  "hsl(260 30% 75%)",
  "hsl(190 35% 70%)",
  "hsl(340 40% 78%)",
  "hsl(90 30% 70%)",
];

export const CarteiraPorAtivador = ({ rows, etapasExcluidas, onEtapasExcluidasChange }: Props) => {

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

  const { lista, perfis } = useMemo(() => {
    const map = new Map<string, Record<string, number> & { count: number }>();
    const perfisSet = new Set<string>();
    for (const r of filteredRows) {
      const k = r.agente_ativacao?.trim() || SEM_RESP;
      const p = (r.perfil_cliente?.trim().split(/\s+/)[0] || "—").toUpperCase();
      perfisSet.add(p);
      const cur = map.get(k) ?? ({ count: 0 } as Record<string, number> & { count: number });
      cur.count += 1;
      cur[p] = (cur[p] ?? 0) + 1;
      map.set(k, cur);
    }
    const ORDER = ["P", "M", "G", "GG", "—"];
    const perfis = [...perfisSet].sort((a, b) => {
      const ia = ORDER.indexOf(a);
      const ib = ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    const lista = [...map.entries()]
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => b.count - a.count);
    return { lista, perfis };
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
              <XAxis type="number" hide />

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
                formatter={(value: number, name) => [`${value} clientes`, `Perfil ${name}`]}
                labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
              {perfis.map((p, i) => {
                const isLast = i === perfis.length - 1;
                return (
                  <Bar
                    key={p}
                    dataKey={p}
                    name={p}
                    stackId="carteira"
                    fill={PERFIL_COLORS[p] ?? PERFIL_FALLBACKS[i % PERFIL_FALLBACKS.length]}
                    radius={isLast ? [0, 4, 4, 0] : [0, 0, 0, 0]}
                  >
                    {isLast && (
                      <LabelList
                        dataKey="count"
                        position="right"
                        style={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 700 }}
                      />
                    )}
                  </Bar>
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
};
