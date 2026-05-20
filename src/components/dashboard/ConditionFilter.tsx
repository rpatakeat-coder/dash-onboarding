import { useState } from "react";
import { Filter, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type NumOp =
  | "gt" | "gte" | "lt" | "lte" | "eq" | "neq"
  | "between" | "not_between" | "empty" | "not_empty";
export type TextOp =
  | "contains" | "not_contains" | "starts_with" | "ends_with"
  | "eq" | "neq" | "empty" | "not_empty";

export type ConditionValue =
  | { kind: "number"; op: NumOp; v1?: number; v2?: number }
  | { kind: "text"; op: TextOp; v1?: string }
  | null;

interface Props {
  kind: "number" | "text";
  value: ConditionValue;
  onChange: (v: ConditionValue) => void;
  label?: string;
}

const NUM_OPS: { op: NumOp; label: string; needs: 0 | 1 | 2 }[] = [
  { op: "gt", label: "Maior que", needs: 1 },
  { op: "gte", label: "Maior ou igual a", needs: 1 },
  { op: "lt", label: "Menor que", needs: 1 },
  { op: "lte", label: "Menor ou igual a", needs: 1 },
  { op: "eq", label: "É igual a", needs: 1 },
  { op: "neq", label: "É diferente de", needs: 1 },
  { op: "between", label: "Está entre", needs: 2 },
  { op: "not_between", label: "Não está entre", needs: 2 },
  { op: "empty", label: "Está vazio", needs: 0 },
  { op: "not_empty", label: "Não está vazio", needs: 0 },
];

const TEXT_OPS: { op: TextOp; label: string; needs: 0 | 1 }[] = [
  { op: "contains", label: "Contém", needs: 1 },
  { op: "not_contains", label: "Não contém", needs: 1 },
  { op: "starts_with", label: "Começa com", needs: 1 },
  { op: "ends_with", label: "Termina com", needs: 1 },
  { op: "eq", label: "É igual a", needs: 1 },
  { op: "neq", label: "É diferente de", needs: 1 },
  { op: "empty", label: "Está vazio", needs: 0 },
  { op: "not_empty", label: "Não está vazio", needs: 0 },
];

export function evalCondition(cond: ConditionValue, raw: string | number | null | undefined): boolean {
  if (!cond) return true;
  if (cond.kind === "number") {
    const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? "").replace(",", "."));
    const isNum = Number.isFinite(n);
    switch (cond.op) {
      case "empty": return !isNum || n === 0 && (raw === "" || raw == null);
      case "not_empty": return isNum;
    }
    if (!isNum) return false;
    const a = cond.v1 ?? 0;
    const b = cond.v2 ?? 0;
    switch (cond.op) {
      case "gt": return n > a;
      case "gte": return n >= a;
      case "lt": return n < a;
      case "lte": return n <= a;
      case "eq": return n === a;
      case "neq": return n !== a;
      case "between": return n >= Math.min(a, b) && n <= Math.max(a, b);
      case "not_between": return n < Math.min(a, b) || n > Math.max(a, b);
    }
  } else {
    const s = String(raw ?? "").toLowerCase().trim();
    const q = (cond.v1 ?? "").toLowerCase().trim();
    switch (cond.op) {
      case "contains": return s.includes(q);
      case "not_contains": return !s.includes(q);
      case "starts_with": return s.startsWith(q);
      case "ends_with": return s.endsWith(q);
      case "eq": return s === q;
      case "neq": return s !== q;
      case "empty": return s === "";
      case "not_empty": return s !== "";
    }
  }
  return true;
}

export function ConditionFilter({ kind, value, onChange, label }: Props) {
  const [open, setOpen] = useState(false);
  const active = !!value;
  const ops = kind === "number" ? NUM_OPS : TEXT_OPS;

  const [draft, setDraft] = useState<ConditionValue>(value);

  const apply = () => { onChange(draft); setOpen(false); };
  const clear = () => { setDraft(null); onChange(null); setOpen(false); };

  const currentOp = (draft && draft.kind === kind ? draft.op : null) as string | null;
  const needs =
    currentOp == null
      ? 0
      : (ops.find((o) => o.op === currentOp)?.needs ?? 0);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setDraft(value); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded transition",
            active
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground/60 hover:text-primary",
          )}
          title={active ? "Filtro condicional ativo" : "Filtrar por condição"}
          aria-label="Filtrar por condição"
        >
          <Filter className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-subtitle text-xs font-semibold text-foreground">
            {label ?? "Filtrar por condição"}
          </p>
          {active && (
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive"
            >
              <X className="h-3 w-3" /> limpar
            </button>
          )}
        </div>
        <select
          value={currentOp ?? ""}
          onChange={(e) => {
            const op = e.target.value || null;
            if (!op) { setDraft(null); return; }
            setDraft(
              kind === "number"
                ? { kind: "number", op: op as NumOp }
                : { kind: "text", op: op as TextOp },
            );
          }}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
        >
          <option value="">Selecione…</option>
          {ops.map((o) => (
            <option key={o.op} value={o.op}>{o.label}</option>
          ))}
        </select>
        {needs > 0 && (
          <div className="mt-2 flex flex-col gap-1.5">
            <Input
              type={kind === "number" ? "number" : "text"}
              placeholder={needs === 2 ? "Mínimo" : "Valor"}
              value={(draft && "v1" in draft ? draft.v1 ?? "" : "") as string | number}
              onChange={(e) => {
                if (!draft) return;
                const raw = e.target.value;
                const v = kind === "number" ? (raw === "" ? undefined : parseFloat(raw)) : raw;
                setDraft({ ...draft, v1: v } as ConditionValue);
              }}
              className="h-8 text-xs"
            />
            {needs === 2 && (
              <Input
                type="number"
                placeholder="Máximo"
                value={(draft && draft.kind === "number" ? draft.v2 ?? "" : "") as number | ""}
                onChange={(e) => {
                  if (!draft || draft.kind !== "number") return;
                  const raw = e.target.value;
                  setDraft({ ...draft, v2: raw === "" ? undefined : parseFloat(raw) });
                }}
                className="h-8 text-xs"
              />
            )}
          </div>
        )}
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={apply} disabled={!draft}>
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
