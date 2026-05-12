import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useDashOperacoes } from "@/hooks/useDashOperacoes";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/contexts/PreferencesContext";

export type NotifKind = "slaCritico" | "parado" | "meta";

export interface Notification {
  id: string;
  kind: NotifKind;
  title: string;
  description: string;
  dealId?: number;
  createdAt: number;
}

interface Ctx {
  items: Notification[];
  unreadCount: number;
  isRead: (id: string) => boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

const NotificationsContext = createContext<Ctx | null>(null);

const readKey = (uid: string) => `notif:read:${uid}`;
const seenKey = (uid: string) => `notif:seen:${uid}`;

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const { data } = useDashOperacoes();
  const { session } = useAuth();
  const { notif } = usePreferences();
  const userId = session?.user.id ?? "anon";
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem(readKey(userId)) || "[]");
      setReadIds(new Set(r));
      const s = JSON.parse(localStorage.getItem(seenKey(userId)) || "[]");
      seenRef.current = new Set(s);
    } catch {
      // ignore
    }
  }, [userId]);

  const items = useMemo<Notification[]>(() => {
    if (!data) return [];
    const out: Notification[] = [];
    if (notif.slaCritico) {
      for (const c of data.criticos.slice(0, 50)) {
        out.push({
          id: `sla:${c.id}`,
          kind: "slaCritico",
          title: `SLA crítico — ${c.cliente}`,
          description: `${c.dias} dias na etapa "${c.etapa}" · ${c.ativador || "Sem ativador"}`,
          dealId: c.id,
          createdAt: Date.now(),
        });
      }
    }
    if (notif.parado) {
      for (const c of (data.criticos || []).filter((c) => c.dias > 30).slice(0, 30)) {
        out.push({
          id: `par:${c.id}`,
          kind: "parado",
          title: `Deal parado há ${c.dias} dias`,
          description: `${c.cliente} · ${c.etapa}`,
          dealId: c.id,
          createdAt: Date.now(),
        });
      }
    }
    if (notif.meta) {
      for (const op of (data.operadores || []).filter((o) => o.ativos >= 10).slice(0, 10)) {
        out.push({
          id: `meta:${op.nome}`,
          kind: "meta",
          title: `Meta atingida — ${op.nome}`,
          description: `${op.ativos} restaurantes ativos`,
          createdAt: Date.now(),
        });
      }
    }
    // dedupe by id
    const seen = new Set<string>();
    return out.filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true)));
  }, [data, notif]);

  // toast on truly new alerts (this session)
  useEffect(() => {
    if (!items.length) return;
    const fresh = items.filter((n) => !seenRef.current.has(n.id));
    if (fresh.length === 0) return;
    fresh.forEach((n) => seenRef.current.add(n.id));
    localStorage.setItem(seenKey(userId), JSON.stringify([...seenRef.current]));
    if (fresh.length <= 3) {
      fresh.forEach((n) =>
        toast(n.title, { description: n.description, duration: 4000 }),
      );
    } else {
      toast(`${fresh.length} novos alertas`, {
        description: "Abra o sino no header para revisar.",
      });
    }
  }, [items, userId]);

  const persistRead = (next: Set<string>) => {
    setReadIds(new Set(next));
    localStorage.setItem(readKey(userId), JSON.stringify([...next]));
  };

  const value: Ctx = {
    items,
    unreadCount: items.filter((n) => !readIds.has(n.id)).length,
    isRead: (id) => readIds.has(id),
    markRead: (id) => {
      const next = new Set(readIds);
      next.add(id);
      persistRead(next);
    },
    markAllRead: () => persistRead(new Set(items.map((n) => n.id))),
    clear: () => persistRead(new Set(items.map((n) => n.id))),
  };

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
};

export const isRead = (readIds: Set<string>, id: string) => readIds.has(id);
