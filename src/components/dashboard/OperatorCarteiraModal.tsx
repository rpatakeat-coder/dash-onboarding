import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronRight, Search, Sparkles, Loader2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SlaBandBar } from "./SlaBandBar";
import { DealLink } from "./DealLink";
import {
  SLA_BAND_META,
  fmtBRL,
  type OperatorStat,
  type SlaBand,
} from "@/hooks/useDashOperacoes";
import { useOperatorRecommendations } from "@/hooks/useOperatorRecommendations";
import { toast } from "sonner";

interface Props {
  operador: OperatorStat | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const ORDER: SlaBand[] = ["critico", "atencao", "alerta", "saudavel"];

export const OperatorCarteiraModal = ({ operador, open, onOpenChange }: Props) => {
  const [expanded, setExpanded] = useState<Record<SlaBand, boolean>>({
    critico: true,
    atencao: true,
    alerta: true,
    saudavel: false,
  });
  const [search, setSearch] = useState("");
  const [bandFilter, setBandFilter] = useState<Set<SlaBand>>(new Set());
  const [recsContent, setRecsContent] = useState<string | null>(null);
  const recsMutation = useOperatorRecommendations();

  const term = search.trim().toLowerCase();

  const grouped = useMemo(() => {
    const g: Record<SlaBand, OperatorStat["clientes"]> = {
      critico: [], atencao: [], alerta: [], saudavel: [],
    };
    if (!operador) return g;
    const filtered = operador.clientes.filter((c) => {
      if (bandFilter.size && !bandFilter.has(c.band)) return false;
      if (!term) return true;
      return (
        c.cliente.toLowerCase().includes(term) ||
        c.etapa.toLowerCase().includes(term) ||
        String(c.id).includes(term)
      );
    });
    for (const c of filtered) g[c.band].push(c);
    for (const k of ORDER) g[k].sort((a, b) => b.sla - a.sla);
    return g;
  }, [operador, term, bandFilter]);

  const totalFiltrados = useMemo(
    () => ORDER.reduce((s, k) => s + (grouped[k]?.length ?? 0), 0),
    [grouped],
  );

  const hasFilters = term.length > 0 || bandFilter.size > 0;

  const toggleBand = (k: SlaBand) =>
    setBandFilter((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  if (!operador) return null;

  const toggle = (k: SlaBand) =>
    setExpanded((s) => ({ ...s, [k]: !s[k] }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Carteira · {operador.nome}
          </DialogTitle>
          <DialogDescription>
            {operador.ativos} clientes · {fmtBRL(operador.mrr)} sob gestão · SLA médio{" "}
            {operador.tempoMedio.toFixed(1)}d
          </DialogDescription>
        </DialogHeader>

        <SlaBandBar bands={operador.bands} height="lg" showLabels />

        {/* Sugestões da IA */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="font-subtitle text-xs font-semibold text-foreground">Sugestões da IA</p>
                <p className="font-small text-[11px] text-muted-foreground">
                  Ações priorizadas com base na carteira deste ativador.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  const content = await recsMutation.mutateAsync({ operador });
                  setRecsContent(content);
                } catch (e) {
                  toast.error("Falha ao gerar sugestões", { description: (e as Error).message });
                }
              }}
              disabled={recsMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-card px-2.5 py-1 font-subtitle text-xs font-medium text-primary transition hover:bg-primary/10 disabled:opacity-60"
            >
              {recsMutation.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> Gerando…
                </>
              ) : recsContent ? (
                "Regenerar"
              ) : (
                "Gerar sugestões"
              )}
            </button>
          </div>
          {recsContent && (
            <div className="prose prose-sm mt-3 max-w-none dark:prose-invert prose-p:my-1 prose-ol:my-1 prose-li:my-0.5">
              <ReactMarkdown>{recsContent}</ReactMarkdown>
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, etapa ou ID do deal…"
              className="pl-9 pr-9"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
                aria-label="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {ORDER.map((k) => {
              const meta = SLA_BAND_META[k];
              const total = operador.bands[k];
              const active = bandFilter.has(k);
              const color = `hsl(var(${meta.cssVar}))`;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleBand(k)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-subtitle text-xs font-medium transition",
                    active ? "shadow-sm-soft" : "hover:bg-muted/60",
                  )}
                  style={{
                    borderColor: active
                      ? color
                      : `${color.replace("hsl(", "hsla(").replace(")", ", 0.35)")}`,
                    backgroundColor: active
                      ? `${color.replace("hsl(", "hsla(").replace(")", ", 0.16)")}`
                      : "transparent",
                    color,
                  }}
                  aria-pressed={active}
                  title={`${meta.label} · ${meta.range}`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {meta.label}
                  <span className="font-numeric tabular-nums opacity-80">{total}</span>
                </button>
              );
            })}
            {bandFilter.size > 0 && (
              <button
                onClick={() => setBandFilter(new Set())}
                className="rounded-full px-2 py-1 font-subtitle text-[11px] text-muted-foreground hover:text-destructive"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
        {hasFilters && (
          <p className="font-small text-[11px] text-muted-foreground">
            {totalFiltrados} cliente{totalFiltrados === 1 ? "" : "s"} encontrado{totalFiltrados === 1 ? "" : "s"}
          </p>
        )}

        <div className="mt-2 max-h-[55vh] space-y-3 overflow-auto pr-1">
          {ORDER.map((k) => {
            const meta = SLA_BAND_META[k];
            const list = grouped[k];
            const count = list.length;
            const totalBand = operador.bands[k];
            const mrr = operador.bandsMrr[k];
            const isOpen = hasFilters ? count > 0 : expanded[k];
            const color = `hsl(var(${meta.cssVar}))`;
            return (
              <div
                key={k}
                className="overflow-hidden rounded-xl border"
                style={{ borderColor: totalBand > 0 ? color : undefined }}
              >
                <button
                  onClick={() => toggle(k)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-muted/50"
                  style={{
                    backgroundColor: totalBand > 0 ? `${color.replace("hsl(", "hsla(").replace(")", ", 0.08)")}` : undefined,
                  }}
                >
                  <div className="flex items-center gap-3">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <div>
                      <p className="font-subtitle text-sm font-semibold text-foreground">
                        {meta.label}{" "}
                        <span className="font-normal text-muted-foreground">({meta.range})</span>
                      </p>
                      <p className="font-small text-[11px] text-muted-foreground">
                        {count} cliente{count === 1 ? "" : "s"} · {fmtBRL(mrr)}
                      </p>
                    </div>
                  </div>
                </button>
                {isOpen && count > 0 && (
                  <ul className="divide-y divide-border bg-card">
                    {list.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between gap-3 px-4 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-subtitle text-sm font-semibold text-foreground">
                            <DealLink id={c.id}>{c.cliente}</DealLink>
                          </p>
                          <p className="truncate font-small text-[11px] text-muted-foreground">
                            {c.etapa} · perfil {c.perfil}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3 text-right">
                          <span className="font-numeric text-xs text-muted-foreground">
                            {c.mrr ? fmtBRL(c.mrr) : "—"}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 font-numeric text-xs font-bold tabular-nums",
                            )}
                            style={{
                              backgroundColor: `${color.replace("hsl(", "hsla(").replace(")", ", 0.15)")}`,
                              color,
                            }}
                          >
                            {c.sla.toFixed(0)}d
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {isOpen && count === 0 && (
                  <p className="bg-card px-4 py-3 font-small text-xs text-muted-foreground">
                    Nenhum cliente nessa faixa.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
