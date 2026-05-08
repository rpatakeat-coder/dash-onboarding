import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Briefcase,
  LayoutDashboard,
  Tv as TvIcon,
  Moon,
  Sun,
  Settings,
  Building2,
  User,
  Globe,
  Zap,
} from "lucide-react";
import {
  slaBand,
  SLA_BAND_META,
  useDashOperacoes,
  type DashRow,
  type OperatorStat,
  type SlaBand,
} from "@/hooks/useDashOperacoes";
import { useDealDrawer } from "@/contexts/DealDrawer";
import { usePreferences } from "@/contexts/PreferencesContext";
import { cn } from "@/lib/utils";

const BANDS: SlaBand[] = ["critico", "atencao", "alerta", "saudavel"];

interface Props {
  onOpenPreferences: () => void;
}

type Scope = "all" | "pages" | "operators" | "deals" | "actions";
type Period = "7d" | "30d" | "tudo";

const SCOPES: { id: Scope; label: string; icon: typeof Globe }[] = [
  { id: "all", label: "Tudo", icon: Globe },
  { id: "pages", label: "Páginas", icon: LayoutDashboard },
  { id: "operators", label: "Operadores", icon: User },
  { id: "deals", label: "Deals", icon: Building2 },
  { id: "actions", label: "Ações", icon: Zap },
];

const PERIODS: { id: Period; label: string; days?: number }[] = [
  { id: "7d", label: "7 dias", days: 7 },
  { id: "30d", label: "30 dias", days: 30 },
  { id: "tudo", label: "Tudo" },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const scoreMatch = (haystack: string, q: string): number => {
  if (!q) return 1;
  const h = norm(haystack);
  const n = norm(q);
  const idx = h.indexOf(n);
  if (idx === -1) return 0;
  // earlier match + shorter haystack = higher
  return 1000 - idx - h.length * 0.05;
};

const dateMs = (d?: string | null) => {
  if (!d) return 0;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : 0;
};

export const CommandPalette = ({ onOpenPreferences }: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [period, setPeriod] = useState<Period>("tudo");
  const [stages, setStages] = useState<Set<string>>(new Set());
  const [bands, setBands] = useState<Set<SlaBand>>(new Set());
  const navigate = useNavigate();
  const { data } = useDashOperacoes();
  const { open: openDeal } = useDealDrawer();
  const { cycleTheme, theme } = usePreferences();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        onOpenPreferences();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        cycleTheme();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenPreferences, cycleTheme]);

  // Reset filters when reopening
  useEffect(() => {
    if (open) return;
    setQuery("");
  }, [open]);

  const operators = useMemo(() => {
    const list = (data?.operadores ?? []).map((op) => ({
      op,
      score: scoreMatch(op.nome, query),
    }));
    return list
      .filter((x) => x.score > 0)
      .sort((a, b) =>
        b.score === a.score ? b.op.ativos - a.op.ativos : b.score - a.score,
      )
      .slice(0, 30);
  }, [data, query]);

  const deals = useMemo(() => {
    const cutoff =
      period === "tudo"
        ? 0
        : Date.now() - (PERIODS.find((p) => p.id === period)?.days ?? 0) * 86400000;
    const list = (data?.rows ?? [])
      .filter((d) => {
        if (cutoff && dateMs(d.data_entrada_fase) < cutoff) return false;
        return true;
      })
      .map((d) => {
        const text = `${d.nome_negocio ?? ""} ${d.etapa_negocio ?? ""} ${d.agente_ativacao ?? ""}`;
        return { d, score: scoreMatch(text, query), recency: dateMs(d.data_entrada_fase) };
      })
      .filter((x) => x.score > 0);
    return list
      .sort((a, b) => (b.score === a.score ? b.recency - a.recency : b.score - a.score))
      .slice(0, 80);
  }, [data, query, period]);

  const showPages = scope === "all" || scope === "pages";
  const showActions = scope === "all" || scope === "actions";
  const showOperators = (scope === "all" || scope === "operators") && operators.length > 0;
  const showDeals = (scope === "all" || scope === "deals") && deals.length > 0;
  const showPeriodChips = scope === "all" || scope === "deals";

  const run = (fn: () => void) => {
    setOpen(false);
    setTimeout(fn, 50);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
      <CommandInput
        placeholder="Buscar páginas, operadores, deals ou ações..."
        value={query}
        onValueChange={setQuery}
      />
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-2">
        {SCOPES.map((s) => {
          const Icon = s.icon;
          const active = scope === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setScope(s.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-subtitle text-[11px] font-medium transition",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3 w-3" />
              {s.label}
            </button>
          );
        })}
        {showPeriodChips && (
          <>
            <span className="mx-1 h-4 w-px bg-border" />
            <span className="font-subtitle text-[10px] uppercase tracking-wider text-muted-foreground">
              Período
            </span>
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={cn(
                  "rounded-full border px-2 py-0.5 font-numeric text-[10px] transition",
                  period === p.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </>
        )}
      </div>
      <CommandList>
        <CommandEmpty>Nenhum resultado.</CommandEmpty>
        {showPages && (
          <CommandGroup heading="Navegação">
            {[
              { to: "/", label: "Visão geral", Icon: LayoutDashboard },
              { to: "/minha-carteira", label: "Minha carteira", Icon: Briefcase },
              { to: "/tv", label: "Modo TV", Icon: TvIcon },
            ]
              .filter((p) => scoreMatch(p.label, query) > 0)
              .map(({ to, label, Icon }) => (
                <CommandItem key={to} value={`page ${label}`} onSelect={() => run(() => navigate(to))}>
                  <Icon className="mr-2 h-4 w-4" /> {label}
                </CommandItem>
              ))}
          </CommandGroup>
        )}
        {showActions && (
          <>
            {showPages && <CommandSeparator />}
            <CommandGroup heading="Ações">
              {[
                {
                  key: "theme",
                  label: `Alternar tema (atual: ${theme})`,
                  Icon: theme === "dark" ? Sun : Moon,
                  fn: cycleTheme,
                },
                { key: "prefs", label: "Preferências", Icon: Settings, fn: onOpenPreferences },
              ]
                .filter((a) => scoreMatch(a.label, query) > 0)
                .map(({ key, label, Icon, fn }) => (
                  <CommandItem key={key} value={`action ${label}`} onSelect={() => run(fn)}>
                    <Icon className="mr-2 h-4 w-4" /> {label}
                  </CommandItem>
                ))}
            </CommandGroup>
          </>
        )}
        {showOperators && (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Operadores (${operators.length})`}>
              {operators.map(({ op }: { op: OperatorStat }) => (
                <CommandItem
                  key={op.nome}
                  value={`op ${op.nome}`}
                  onSelect={() =>
                    run(() => window.dispatchEvent(new CustomEvent("open-operator", { detail: op })))
                  }
                >
                  <User className="mr-2 h-4 w-4" />
                  <span className="flex-1">{op.nome}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{op.ativos} ativos</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {showDeals && (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Deals (${deals.length})`}>
              {deals.map(({ d }: { d: DashRow }) => (
                <CommandItem
                  key={d.id_deal}
                  value={`deal ${d.nome_negocio ?? d.id_deal}`}
                  onSelect={() => run(() => openDeal(d))}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  <span className="flex-1 truncate">{d.nome_negocio || `Deal ${d.id_deal}`}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{d.etapa_negocio ?? "—"}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};
