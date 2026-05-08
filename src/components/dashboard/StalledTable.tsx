import { AlertTriangle, Clock } from "lucide-react";

const atrasos = [
  { cliente: "Restaurante Sabor & Arte", ativador: "Ana Souza", etapa: "Treinamento", dias: 23 },
  { cliente: "Cantina Bella Vita", ativador: "Bruno Lima", etapa: "Configuração", dias: 19 },
  { cliente: "Burger Station", ativador: "Carla Mendes", etapa: "Testes", dias: 17 },
  { cliente: "Sushi Hokkaido", ativador: "Ana Souza", etapa: "Configuração", dias: 15 },
  { cliente: "Padaria Vovó Maria", ativador: "Diego Rocha", etapa: "Treinamento", dias: 12 },
];

export const StalledTable = () => {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm-soft">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
            <AlertTriangle className="h-4.5 w-4.5 text-destructive" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-secondary">
              Onboardings travados
            </h2>
            <p className="font-small text-xs text-muted-foreground">
              Sem evolução há mais de 10 dias
            </p>
          </div>
        </div>
        <span className="rounded-full bg-destructive/10 px-3 py-1 font-subtitle text-xs font-bold text-destructive">
          {atrasos.length} críticos
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="font-subtitle text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 text-left">Restaurante</th>
              <th className="px-4 py-3 text-left">Ativador</th>
              <th className="px-4 py-3 text-left">Etapa</th>
              <th className="px-4 py-3 text-right">Parado há</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {atrasos.map((a) => (
              <tr key={a.cliente} className="transition-colors hover:bg-muted/30">
                <td className="px-4 py-3 font-semibold text-foreground">{a.cliente}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.ativador}</td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-secondary/10 px-2 py-0.5 font-subtitle text-xs font-medium text-secondary">
                    {a.etapa}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex items-center gap-1 font-numeric font-bold text-destructive">
                    <Clock className="h-3.5 w-3.5" />
                    {a.dias}d
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
