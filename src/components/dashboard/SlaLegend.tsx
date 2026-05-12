import { useEffect, useState } from "react";
import { Info, ChevronDown, ChevronUp, Clock, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "sla-legend-collapsed";

/**
 * Fixed legend explaining the two SLA fields used across the dashboard.
 * Collapsible; preference persists in localStorage.
 */
export const SlaLegend = ({ className }: { className?: string }) => {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* noop */
    }
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* noop */
      }
      return next;
    });
  };

  return (
    <aside
      className={cn(
        "rounded-2xl border border-primary/30 bg-primary/[0.04] p-4 pdf-hide",
        className,
      )}
      aria-label="Legenda dos campos de SLA"
    >
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 text-left focus:outline-none"
        aria-expanded={!collapsed}
      >
        <Info className="h-4 w-4 shrink-0 text-primary" />
        <span className="font-subtitle text-[11px] font-semibold uppercase tracking-widest text-primary">
          Como ler os SLAs deste dashboard
        </span>
        <span className="ml-auto text-muted-foreground">
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </span>
      </button>

      {!collapsed && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              <p className="font-display text-sm font-semibold text-foreground">
                SLA na etapa
              </p>
              <code className="ml-auto rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                sla_dias_etapa
              </code>
            </div>
            <p className="mt-2 font-small text-xs leading-relaxed text-muted-foreground">
              Dias que o deal está parado na <strong>etapa atual</strong> do funil.
              Usado em: <strong>SLA médio</strong>, <strong>% no prazo (≤30d)</strong>,{" "}
              <strong>% estourado (&gt;30d)</strong>, faixas (saudável/alerta/atenção/crítico),
              gargalos por etapa e ranking de risco.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <p className="font-display text-sm font-semibold text-foreground">
                SLA desde a criação
              </p>
              <code className="ml-auto rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                sla_dias_criacao
              </code>
            </div>
            <p className="mt-2 font-small text-xs leading-relaxed text-muted-foreground">
              Dias desde a <strong>criação do deal</strong>, somando todas as etapas.
              Usado em: <strong>P75 SLA</strong> e no filtro{" "}
              <strong>acima/abaixo do P75</strong>.
            </p>
          </div>
        </div>
      )}
    </aside>
  );
};
