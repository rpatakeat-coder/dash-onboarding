import { useCallback, useEffect, useState } from "react";

export interface ExportHistoryEntry {
  id: string;
  createdAt: number;
  title: string;
  subtitle: string;
  period: string;
  filtersText: string;
  includeCover: boolean;
  includeToc: boolean;
  includeWatermark: boolean;
  includeFooter: boolean;
  pageCount: number;
}

const KEY = "takeat:pdf-export-history:v1";
const MAX_ENTRIES = 20;

const read = (): ExportHistoryEntry[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ExportHistoryEntry[];
  } catch {
    return [];
  }
};

const write = (entries: ExportHistoryEntry[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn("[useExportHistory] falha ao persistir:", e);
  }
};

/**
 * Histórico local (localStorage) das exportações de PDF.
 * Guarda apenas metadados para reabrir e regerar — não armazena o PDF em si.
 */
export const useExportHistory = () => {
  const [entries, setEntries] = useState<ExportHistoryEntry[]>(() => read());

  // Sincroniza entre abas
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setEntries(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback((entry: Omit<ExportHistoryEntry, "id" | "createdAt">) => {
    const full: ExportHistoryEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    };
    setEntries((prev) => {
      const next = [full, ...prev].slice(0, MAX_ENTRIES);
      write(next);
      return next;
    });
    return full;
  }, []);

  const remove = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      write(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setEntries([]);
    write([]);
  }, []);

  return { entries, add, remove, clear };
};
