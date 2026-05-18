import { useMemo } from "react";
import { AlertTriangle, TrendingDown, Clock, Flame, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  parseDate,
  parseActivationDate,
  slaReal,
  fmtBRLk,
  type DashRow,
} from "@/hooks/useDashOperacoes";

interface Props {
  rows: DashRow[];
  onSelectOperator?: (name: string) => void;
}

type Tone = "danger" | "warning" | "primary";

interface AlertCard {
  key: string;
  icon: typeof TrendingDown;
  tone: Tone;
  label: string;
  value: string;
  hint: string;
  chips: { name: string; meta: string }[];
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const toMrr = (v: string | null | undefined) =>
  parseFloat(String(v ?? "").replace(",", ".")) || 0;

const TONE_BORDER: Record<Tone, string> = {
  danger: "border-destructive/40 bg-destructive/[0.04]",
  warning: "border-amber-500/40 bg-amber-500/[0.05]",
  primary: "border-primary/40 bg-primary/[0.05]",
};
const TONE_ICON: Record<Tone, string> = {
  danger: "text-destructive bg-destructive/10",
  warning: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
  primary: "text-primary bg-primary/10",
};

export const GestaoAlerts = ({ rows, onSelectOperator }: Props) => {
  const alerts = useMemo<AlertCard[]>(() => {
    const now = new Date();
    const today = startOfDay(now);
    const d7 = new Date(today); d7.setDate(today.getDate() - 7);
    const d14 = new Date(today); d14.setDate(today.getDate() - 14);

    // Ativações últimos 7d vs. 7d anteriores
    const ativThis = new Map<string, number>();
    const ativPrev = new Map<string, number>();
    for (const r of rows) {
      const da = parseActivationDate(r.data_ativacao);
      if (!da) continue;
      const k = r.agente_ativacao?.trim() || "Sem responsável";
      if (da >= d7 && da <= now) ativThis.set(k, (ativThis.get(k) || 0) + 1);
      else if (da >= d14 && da < d7) ativPrev.set(k, (ativPrev.get(k) || 0) + 1);
    }
    const quedas: { name: string; cur: number; prev: number; delta: number }[] = [];
    for (const [name, prev] of ativPrev) {
      const cur = ativThis.get(name) || 0;
      if (prev >= 2 && cur < prev * 0.7) {
        const delta = ((cur - prev) / prev) * 100;
        quedas.push({ name, cur, prev, delta });
      }
    }
    quedas.sort((a, b) => a.delta - b.delta);

    // Deals parados >30d (sla real)
    const parados = new Map<string, number>();
    for (const r of rows) {
      if (slaReal(r) > 30) {
        const k = r.agente_ativacao?.trim() || "Sem responsável";
        parados.set(k, (parados.get(k) || 0) + 1);
      }
    }
    const paradosTop = [...parados].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const paradosTot = [...parados.values()].reduce((s, n) => s + n, 0);

    // MRR crítico parado
    const mrrCrit = new Map<string, number>();
    let mrrCritTot = 0;
    for (const r of rows) {
      if (slaReal(r) > 30) {
        const k = r.agente_ativacao?.trim() || "Sem responsável";
        const m = toMrr(r.mrr);
        mrrCrit.set(k, (mrrCrit.get(k) || 0) + m);
        mrrCritTot += m;
      }
    }
    const mrrCritTop = [...mrrCrit].sort((a, b) => b[1] - a[1]).slice(0, 3);

    // Sem movimento (data_entrada_fase > 14d)
    const semMov = new Map<string, number>();
    for (const r of rows) {
      const de = parseDate(r.data_entrada_fase);
      if (de && de < d14) {
        const k = r.agente_ativacao?.trim() || "Sem responsável";
        semMov.set(k, (semMov.get(k) || 0) + 1);
      }
    }
    const semMovTop = [...semMov].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const semMovTot = [...semMov.values()].reduce((s, n) => s + n, 0);

    return [
      {
        key: "queda",
        icon: TrendingDown,
        tone: "danger",
        label: "Operadores em queda",
        value: String(quedas.length),
        hint: "Ativações 7d vs. 7d anteriores (queda >30%)",
        chips: quedas.slice(0, 3).map((q) => ({
          name: q.name,
          meta: `${q.delta > 0 ? "+" : ""}${q.delta.toFixed(0)}% (${q.cur}/${q.prev})`,
        })),
      },
      {
        key: "parados",
        icon: Clock,
        tone: "warning",
        label: "Deals parados >30d",
        value: String(paradosTot),
        hint: "SLA real acima de 30 dias",
        chips: paradosTop.map(([n, v]) => ({ name: n, meta: `${v} deal${v === 1 ? "" : "s"}` })),
      },
      {
        key: "mrrcrit",
        icon: Flame,
        tone: "danger",
        label: "MRR crítico parado",
        value: fmtBRLk(mrrCritTot),
        hint: "MRR de deals com SLA >30d",
        chips: mrrCritTop.map(([n, v]) => ({ name: n, meta: fmtBRLk(v) })),
      },
      {
        key: "semmov",
        icon: AlertTriangle,
        tone: "primary",
        label: "Sem movimento 14+ dias",
        value: String(semMovTot),
        hint: "Sem mudança de fase desde 14 dias atrás",
        chips: semMovTop.map(([n, v]) => ({ name: n, meta: `${v} deal${v === 1 ? "" : "s"}` })),
      },
    ];
  }, [rows]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {alerts.map((a) => {
        const Icon = a.icon;
        return (
          <div
            key={a.key}
            className={cn(
              "flex flex-col gap-3 rounded-2xl border p-4",
              TONE_BORDER[a.tone],
            )}
          >
            <div className="flex items-start gap-3">
              <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", TONE_ICON[a.tone])}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
                  {a.label}
                </p>
                <p className="font-numeric text-2xl font-bold tabular-nums text-foreground">
                  {a.value}
                </p>
                <p className="font-small text-[11px] text-muted-foreground">{a.hint}</p>
              </div>
            </div>
            {a.chips.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {a.chips.map((c) => (
                  <button
                    key={c.name + c.meta}
                    type="button"
                    onClick={() => onSelectOperator?.(c.name)}
                    className="group inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-background/60 px-2 py-1 font-subtitle text-[11px] font-medium text-foreground transition hover:border-primary hover:bg-primary/10"
                    title={`${c.name} — ${c.meta}`}
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="font-numeric font-bold tabular-nums text-muted-foreground group-hover:text-primary">
                      {c.meta}
                    </span>
                    <ArrowRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="font-small text-xs italic text-muted-foreground">Nada a sinalizar aqui.</p>
            )}
          </div>
        );
      })}
    </div>
  );
};
