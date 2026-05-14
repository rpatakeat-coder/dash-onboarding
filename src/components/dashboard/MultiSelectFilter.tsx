import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";

interface Props {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  counts?: Record<string, number>;
  className?: string;
}

export const MultiSelectFilter = ({ label, options, selected, onChange, counts, className }: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [onlySelected, setOnlySelected] = useState(false);

  const sorted = useMemo(() => {
    if (counts) {
      return [...options].sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0) || a.localeCompare(b));
    }
    return [...options].sort((a, b) => a.localeCompare(b));
  }, [options, counts]);

  // Sincroniza a seleção com as opções disponíveis: remove itens
  // selecionados que não estão mais presentes na lista de opções
  // (por exemplo, quando outro filtro reduziu o conjunto de dados).
  useEffect(() => {
    if (selected.size === 0) return;
    const opts = new Set(options);
    let changed = false;
    const next = new Set<string>();
    for (const v of selected) {
      if (opts.has(v)) next.add(v);
      else changed = true;
    }
    if (changed) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const visible = useMemo(() => {
    const q = norm(query.trim());
    let out = sorted;
    if (onlySelected) out = out.filter((o) => selected.has(o));
    if (q) out = out.filter((o) => norm(o).includes(q));
    return out;
  }, [sorted, query, onlySelected, selected]);

  const toggle = (v: string) => {
    const n = new Set(selected);
    n.has(v) ? n.delete(v) : n.add(v);
    onChange(n);
  };
  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(new Set());
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setQuery(""); setOnlySelected(false); } }}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex min-w-[180px] items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 font-subtitle text-sm shadow-sm-soft transition hover:border-primary/40",
            selected.size > 0 && "border-primary/50 ring-1 ring-primary/20",
            className,
          )}
        >
          <span className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {label}
            </span>
            {selected.size === 0 ? (
              <span className="text-muted-foreground">Todos</span>
            ) : (
              <Badge variant="secondary" className="font-numeric">
                {selected.size}
              </Badge>
            )}
          </span>
          <span className="flex items-center gap-1">
            {selected.size > 0 && (
              <X
                className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive"
                onClick={clear}
              />
            )}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={`Buscar ${label.toLowerCase()}...`}
            value={query}
            onValueChange={setQuery}
          />
          <div className="flex flex-wrap items-center justify-between gap-1 border-b border-border px-2 py-1.5 text-[11px]">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setOnlySelected((v) => !v)}
                disabled={selected.size === 0}
                className={cn(
                  "rounded px-1.5 py-0.5 font-subtitle uppercase tracking-wider transition",
                  onlySelected
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                  selected.size === 0 && "opacity-40 cursor-not-allowed",
                )}
              >
                Apenas selecionados ({selected.size})
              </button>
              {query.trim() && selected.size > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const q = norm(query.trim());
                    const next = new Set<string>();
                    for (const v of selected) if (norm(v).includes(q)) next.add(v);
                    onChange(next);
                  }}
                  className="rounded px-1.5 py-0.5 font-subtitle uppercase tracking-wider text-muted-foreground hover:text-primary"
                  title="Mantém apenas os itens já selecionados que batem com o termo buscado"
                >
                  Aplicar busca à seleção
                </button>
              )}
            </div>
            {(query || onlySelected || selected.size > 0) && (
              <button
                type="button"
                onClick={() => { setQuery(""); setOnlySelected(false); onChange(new Set()); }}
                className="rounded px-1.5 py-0.5 font-subtitle uppercase tracking-wider text-muted-foreground hover:text-destructive"
                title="Limpa busca e seleção, restaurando a lista completa"
              >
                Limpar tudo
              </button>
            )}
          </div>
          <CommandList>
            {visible.length === 0 ? (
              <CommandEmpty>Nada encontrado</CommandEmpty>
            ) : (
              <CommandGroup>
                {visible.map((opt) => {
                  const active = selected.has(opt);
                  const c = counts?.[opt];
                  return (
                    <CommandItem
                      key={opt}
                      value={opt}
                      onSelect={() => toggle(opt)}
                      className="cursor-pointer"
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded border",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border",
                        )}
                      >
                        {active && <Check className="h-3 w-3" />}
                      </div>
                      <span className="flex-1 truncate">{opt}</span>
                      {c !== undefined && (
                        <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 font-numeric text-[10px] font-bold tabular-nums text-foreground/70">
                          {c.toLocaleString("pt-BR")}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
