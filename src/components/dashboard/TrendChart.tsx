import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Snap {
  snapshot_date: string;
  total: number;
  pct_no_prazo: number;
  sla_medio: number;
  band_critico: number;
}

export const TrendChart = () => {
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("dash_operacoes_snapshots")
      .select("snapshot_date,total,pct_no_prazo,sla_medio,band_critico")
      .order("snapshot_date", { ascending: true })
      .limit(60)
      .then(({ data }) => {
        setSnaps((data ?? []) as Snap[]);
        setLoading(false);
      });
  }, []);

  const data = useMemo(
    () =>
      snaps.map((s) => ({
        date: new Date(s.snapshot_date).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
        "% SLA no prazo": Number(s.pct_no_prazo.toFixed(1)),
        "Críticos": s.band_critico,
        "SLA médio (d)": Number(s.sla_medio.toFixed(1)),
      })),
    [snaps],
  );

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Tendência (últimos snapshots)
        </h3>
        <span className="ml-auto font-small text-[10px] text-muted-foreground">
          {snaps.length} pontos
        </span>
      </div>
      {loading ? (
        <div className="py-12 text-center font-subtitle text-xs text-muted-foreground">
          Carregando…
        </div>
      ) : data.length < 2 ? (
        <div className="py-12 text-center font-subtitle text-xs text-muted-foreground">
          Aguardando snapshots diários — a tendência aparece após 2 dias.
        </div>
      ) : (
        <div className="h-56 w-full sm:h-64 md:h-72 lg:h-80">
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="% SLA no prazo" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Críticos" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="SLA médio (d)" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
