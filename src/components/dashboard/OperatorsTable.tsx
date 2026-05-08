import { Trophy } from "lucide-react";

const operadores = [
  { nome: "Ana Souza", ativos: 12, concluidos: 28, tempoMedio: 14 },
  { nome: "Bruno Lima", ativos: 9, concluidos: 24, tempoMedio: 16 },
  { nome: "Carla Mendes", ativos: 11, concluidos: 22, tempoMedio: 18 },
  { nome: "Diego Rocha", ativos: 7, concluidos: 19, tempoMedio: 15 },
  { nome: "Elisa Tavares", ativos: 10, concluidos: 17, tempoMedio: 21 },
];

export const OperatorsTable = () => {
  const max = Math.max(...operadores.map((o) => o.concluidos));
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm-soft">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-secondary">
            Performance por ativador
          </h2>
          <p className="font-small text-xs text-muted-foreground">
            Onboardings ativos, concluídos e tempo médio (dias)
          </p>
        </div>
        <Trophy className="h-5 w-5 text-warning" />
      </div>
      <div className="space-y-4">
        {operadores.map((op, i) => (
          <div key={op.nome} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <span className="font-numeric text-xs font-bold text-muted-foreground w-5">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-subtitle font-semibold text-foreground">{op.nome}</span>
              </div>
              <div className="flex items-center gap-4 font-numeric text-xs text-muted-foreground">
                <span><span className="font-bold text-foreground">{op.ativos}</span> ativos</span>
                <span><span className="font-bold text-foreground">{op.concluidos}</span> concluídos</span>
                <span><span className="font-bold text-foreground">{op.tempoMedio}d</span> médio</span>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-primary transition-all"
                style={{ width: `${(op.concluidos / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
