import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Cartões para exibir linhas de tabela no mobile (rótulo: valor empilhado).
 * Padrão: a `<table>` fica em um wrapper `hidden md:block` e a lista de
 * `DataCard` em `md:hidden`, reaproveitando os mesmos dados/formatadores.
 */
export const DataCard = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={cn("rounded-xl border border-border bg-card p-3 shadow-sm-soft", className)}>
    {children}
  </div>
);

export const DataCardHeader = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <div className="mb-1.5 flex items-start justify-between gap-2">
    <div className="min-w-0 font-medium text-foreground">{children}</div>
    {right != null && <div className="shrink-0">{right}</div>}
  </div>
);

export const DataCardRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-center justify-between gap-3 border-t border-border/50 py-1.5 text-sm first:border-t-0">
    <span className="shrink-0 font-subtitle text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
    <span className="min-w-0 break-words text-right text-foreground">{children}</span>
  </div>
);
