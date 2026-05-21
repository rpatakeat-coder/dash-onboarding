import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Trash2, ExternalLink, MessageSquare, ChevronDown, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ---------------- Types ----------------

export type CardStatus = "Risco" | "Acompanhamento" | "Inativo" | "Saudável";

export interface KanbanCardData {
  id: string;
  title: string;
  status: CardStatus;
  diasAtraso: number;
  responsavel: string;
  mrr: number;
  estado: "Pendente" | "Em andamento" | "Concluído";
  dot: "danger" | "warning" | "success";
}

export interface KanbanColumnData {
  id: string;
  title: string;
  cardIds: string[];
}

// ---------------- Seed mock ----------------

const seedCards: Record<string, KanbanCardData> = {
  c1: { id: "c1", title: "KINGBIER - BOULEVARD", status: "Risco", diasAtraso: 2, responsavel: "Sara Silva", mrr: 925, estado: "Pendente", dot: "danger" },
  c2: { id: "c2", title: "Marmitas Sempre Quentinha", status: "Risco", diasAtraso: 1, responsavel: "Vitor Coelho", mrr: 899, estado: "Pendente", dot: "danger" },
  c3: { id: "c3", title: "Baixo Araguaia Fluminense", status: "Risco", diasAtraso: 0, responsavel: "—", mrr: 0, estado: "Pendente", dot: "danger" },
  c4: { id: "c4", title: "Gardens Good Food - GRDE", status: "Acompanhamento", diasAtraso: 6, responsavel: "Nuno Bisi Bolsanello", mrr: 810, estado: "Pendente", dot: "danger" },
  c5: { id: "c5", title: "Terra & Brasa Express", status: "Inativo", diasAtraso: 29, responsavel: "Etyene Nawar", mrr: 809, estado: "Pendente", dot: "danger" },
  c6: { id: "c6", title: "Mirante da orla", status: "Risco", diasAtraso: 5, responsavel: "Ada Costa", mrr: 525, estado: "Pendente", dot: "warning" },
  c7: { id: "c7", title: "Empório Café - Filial", status: "Risco", diasAtraso: 3, responsavel: "Ada Costa", mrr: 499, estado: "Pendente", dot: "warning" },
};

const seedColumns: KanbanColumnData[] = [
  { id: "col-sem-acao", title: "Sem ação", cardIds: ["c1", "c2", "c3"] },
  { id: "col-terca-msg", title: "Terça - Mensagem Automática", cardIds: ["c4", "c5"] },
  { id: "col-lig-quarta", title: "Ligação Quarta", cardIds: [] },
  { id: "col-lig-nao-atend", title: "Ligação Não Atendida Quarta", cardIds: ["c6", "c7"] },
  { id: "col-lig-sexta", title: "Ligação Sexta", cardIds: [] },
];

// ---------------- Board ----------------

export const KanbanBoard = () => {
  const [columns, setColumns] = useState<KanbanColumnData[]>(seedColumns);
  const [cards, setCards] = useState<Record<string, KanbanCardData>>(seedCards);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const columnOfCard = (cardId: string) => columns.find((c) => c.cardIds.includes(cardId));

  const handleDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    if (cards[id]) setActiveCardId(id);
  };

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (!cards[activeId]) return;

    const fromCol = columnOfCard(activeId);
    const toCol = cards[overId] ? columnOfCard(overId) : columns.find((c) => c.id === overId);
    if (!fromCol || !toCol || fromCol.id === toCol.id) return;

    setColumns((prev) => {
      const next = prev.map((c) => ({ ...c, cardIds: [...c.cardIds] }));
      const from = next.find((c) => c.id === fromCol.id)!;
      const to = next.find((c) => c.id === toCol.id)!;
      from.cardIds = from.cardIds.filter((id) => id !== activeId);
      const overIndex = cards[overId] ? to.cardIds.indexOf(overId) : to.cardIds.length;
      const insertAt = overIndex >= 0 ? overIndex : to.cardIds.length;
      to.cardIds.splice(insertAt, 0, activeId);
      return next;
    });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveCardId(null);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (!cards[activeId]) return;
    const col = columnOfCard(activeId);
    if (!col) return;
    if (cards[overId] && col.cardIds.includes(overId) && activeId !== overId) {
      setColumns((prev) =>
        prev.map((c) =>
          c.id === col.id
            ? { ...c, cardIds: arrayMove(c.cardIds, c.cardIds.indexOf(activeId), c.cardIds.indexOf(overId)) }
            : c,
        ),
      );
    }
  };

  const addColumn = () => {
    const id = `col-${Date.now()}`;
    setColumns((prev) => [...prev, { id, title: "Nova coluna", cardIds: [] }]);
  };

  const renameColumn = (id: string, title: string) => {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
  };

  const deleteColumn = (id: string) => {
    const col = columns.find((c) => c.id === id);
    if (!col) return;
    if (col.cardIds.length > 0) {
      const ok = window.confirm(
        `A coluna "${col.title}" contém ${col.cardIds.length} card(s). Deseja excluir mesmo assim? Os cards serão removidos.`,
      );
      if (!ok) return;
    }
    setColumns((prev) => prev.filter((c) => c.id !== id));
    setCards((prev) => {
      const next = { ...prev };
      col.cardIds.forEach((cid) => delete next[cid]);
      return next;
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-3">
        {columns.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            cards={col.cardIds.map((id) => cards[id]).filter(Boolean)}
            onRename={(title) => renameColumn(col.id, title)}
            onDelete={() => deleteColumn(col.id)}
          />
        ))}
        <div className="shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={addColumn}
            className="h-10 gap-2 border-dashed font-subtitle text-sm"
          >
            <Plus className="h-4 w-4" />
            Nova coluna
          </Button>
        </div>
      </div>
      <DragOverlay>
        {activeCardId && cards[activeCardId] ? (
          <div className="rotate-2">
            <CardView card={cards[activeCardId]} dragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

// ---------------- Column ----------------

interface ColumnProps {
  column: KanbanColumnData;
  cards: KanbanCardData[];
  onRename: (title: string) => void;
  onDelete: () => void;
}

const KanbanColumn = ({ column, cards, onRename, onDelete }: ColumnProps) => {
  const { setNodeRef, isOver } = useSortable({ id: column.id, data: { type: "column" } });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(column.title);
  const ids = useMemo(() => cards.map((c) => c.id), [cards]);

  const commit = () => {
    const trimmed = draft.trim() || column.title;
    onRename(trimmed);
    setDraft(trimmed);
    setEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[300px] shrink-0 flex-col rounded-2xl border border-border bg-muted/30 p-2 transition",
        isOver && "ring-2 ring-primary/40",
      )}
    >
      <div className="mb-2 flex items-center gap-1 px-1">
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
        {editing ? (
          <div className="flex flex-1 items-center gap-1">
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") {
                  setDraft(column.title);
                  setEditing(false);
                }
              }}
              className="h-7 font-subtitle text-sm"
            />
            <button onClick={commit} className="text-success" aria-label="Salvar">
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setDraft(column.title);
                setEditing(false);
              }}
              className="text-muted-foreground"
              aria-label="Cancelar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <h3 className="flex-1 truncate font-subtitle text-sm font-semibold text-foreground">
              {column.title}
            </h3>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded p-1 text-muted-foreground transition hover:bg-background hover:text-foreground"
              aria-label="Renomear coluna"
              title="Renomear"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <span className="rounded-full bg-background px-2 py-0.5 font-numeric text-[11px] font-medium text-muted-foreground">
              {cards.length}
            </span>
            <button
              type="button"
              onClick={onDelete}
              className="rounded p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              aria-label="Apagar coluna"
              title="Apagar coluna"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>

      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto pr-1">
          {cards.map((card) => (
            <SortableCard key={card.id} card={card} />
          ))}
          {cards.length === 0 && (
            <div className="rounded-lg border border-dashed border-border py-6 text-center font-small text-xs text-muted-foreground">
              Arraste cards para cá
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};

// ---------------- Card ----------------

const SortableCard = ({ card }: { card: KanbanCardData }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card" },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CardView card={card} />
    </div>
  );
};

const STATUS_STYLES: Record<CardStatus, string> = {
  Risco: "bg-destructive/10 text-destructive border-destructive/20",
  Acompanhamento: "bg-warning/10 text-warning-foreground border-warning/30",
  Inativo: "bg-muted text-muted-foreground border-border",
  Saudável: "bg-success/10 text-success border-success/20",
};

const DOT_STYLES: Record<KanbanCardData["dot"], string> = {
  danger: "bg-destructive",
  warning: "bg-warning",
  success: "bg-success",
};

const CardView = ({ card, dragging }: { card: KanbanCardData; dragging?: boolean }) => {
  return (
    <article
      className={cn(
        "cursor-grab rounded-xl border border-border bg-card p-3 shadow-sm transition active:cursor-grabbing",
        dragging ? "shadow-lg" : "hover:border-primary/30",
      )}
    >
      <header className="mb-2 flex items-start justify-between gap-2">
        <h4 className="font-subtitle text-sm font-semibold text-foreground">{card.title}</h4>
        <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", DOT_STYLES[card.dot])} />
      </header>

      <div className="mb-3 flex items-center gap-1.5">
        <span
          className={cn(
            "rounded-md border px-1.5 py-0.5 font-subtitle text-[10px] font-medium",
            STATUS_STYLES[card.status],
          )}
        >
          {card.status}
        </span>
      </div>

      <div className="mb-2 flex items-end justify-between gap-2">
        <div>
          <p className="font-small text-[11px] text-muted-foreground">{card.responsavel}</p>
        </div>
        <p className="text-right font-small text-[11px] text-muted-foreground">
          {card.diasAtraso}d atraso
        </p>
      </div>
      <div className="mb-3 text-right font-numeric text-xs text-foreground">
        MRR <span className="font-medium">R$ {card.mrr.toFixed(2).replace(".", ",")}</span>
      </div>

      <footer className="flex items-center gap-1 border-t border-border pt-2">
        <button className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 font-subtitle text-[11px] text-foreground hover:bg-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-warning" />
          {card.estado}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
        <button className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Abrir">
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
        <button className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Comentar">
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
        <span className="ml-auto rounded-md border border-warning/30 bg-warning/10 px-1.5 py-0.5 font-subtitle text-[10px] text-warning-foreground">
          Pendente
        </span>
      </footer>
    </article>
  );
};
