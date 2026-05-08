import { Bell, Check, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications } from "@/contexts/NotificationsContext";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = {
  slaCritico: "SLA crítico",
  parado: "Deal parado",
  meta: "Meta atingida",
};

export const NotificationsBell = () => {
  const { items, unreadCount, markRead, markAllRead, clear } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${unreadCount} notificações não lidas`}
          className="relative inline-flex items-center justify-center rounded-lg border border-border bg-card p-2 text-muted-foreground transition hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              aria-live="polite"
              className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 font-numeric text-[10px] font-semibold text-destructive-foreground"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-display text-sm font-semibold">Notificações</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
              title="Marcar todas como lidas"
            >
              <Check className="h-3 w-3" /> Lidas
            </button>
            <button
              onClick={clear}
              disabled={items.length === 0}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-40"
              title="Limpar histórico"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum alerta no momento.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {items.slice(0, 50).map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => markRead(n.id)}
                    className={cn(
                      "block w-full px-4 py-3 text-left transition hover:bg-muted/60",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          "mt-1 inline-block h-2 w-2 shrink-0 rounded-full",
                          n.kind === "slaCritico"
                            ? "bg-destructive"
                            : n.kind === "parado"
                              ? "bg-warning"
                              : "bg-success",
                        )}
                      />
                      <div className="flex-1">
                        <p className="font-subtitle text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          {KIND_LABEL[n.kind]}
                        </p>
                        <p className="font-subtitle text-sm font-medium text-foreground">
                          {n.title}
                        </p>
                        <p className="text-xs text-muted-foreground">{n.description}</p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
