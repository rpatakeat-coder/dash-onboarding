import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const data = [
  { etapa: "Cadastro", count: 12 },
  { etapa: "Configuração", count: 18 },
  { etapa: "Treinamento", count: 9 },
  { etapa: "Testes", count: 6 },
  { etapa: "Go-live", count: 4 },
];

export const FunnelChart = () => {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm-soft">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-secondary">
            Restaurantes por etapa
          </h2>
          <p className="font-small text-xs text-muted-foreground">
            Distribuição atual no funil de onboarding
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 font-subtitle text-xs font-medium text-muted-foreground">
          49 ativos
        </span>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.95} />
              <stop offset="100%" stopColor="hsl(var(--primary-glow))" stopOpacity={0.7} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="etapa" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))" }}
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.75rem",
              fontFamily: "Nunito Sans",
            }}
          />
          <Bar dataKey="count" fill="url(#barFill)" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
