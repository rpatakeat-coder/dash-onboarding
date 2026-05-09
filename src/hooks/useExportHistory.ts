import { useCallback, useEffect, useMemo, useState } from "react";

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

/** Configuração reutilizável salva como padrão do modal. */
export interface ExportDefaults {
  title: string;
  subtitle: string;
  period: string;
  filtersText: string;
  includeCover: boolean;
  includeToc: boolean;
  includeWatermark: boolean;
  includeFooter: boolean;
}

const KEY = "takeat:pdf-export-history:v1";
const DEFAULT_KEY = "takeat:pdf-export-default:v1";
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

const readDefault = (): ExportDefaults | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DEFAULT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ExportDefaults;
  } catch {
    return null;
  }
};

const writeDefault = (cfg: ExportDefaults | null) => {
  if (typeof window === "undefined") return;
  try {
    if (cfg === null) window.localStorage.removeItem(DEFAULT_KEY);
    else window.localStorage.setItem(DEFAULT_KEY, JSON.stringify(cfg));
  } catch (e) {
    console.warn("[useExportHistory] falha ao persistir padrão:", e);
  }
};

const sameDefaults = (a: ExportDefaults | null, b: ExportDefaults | null) => {
  if (!a || !b) return false;
  return (
    a.title === b.title &&
    a.subtitle === b.subtitle &&
    a.period === b.period &&
    a.filtersText === b.filtersText &&
    a.includeCover === b.includeCover &&
    a.includeToc === b.includeToc &&
    a.includeWatermark === b.includeWatermark &&
    a.includeFooter === b.includeFooter
  );
};

/**
 * Histórico local (localStorage) das exportações de PDF + configuração padrão
 * editável que pré-preenche o modal.
 */
export const useExportHistory = () => {
  const [entries, setEntries] = useState<ExportHistoryEntry[]>(() => read());
  const [defaults, setDefaults] = useState<ExportDefaults | null>(() => readDefault());

  // Sincroniza entre abas
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setEntries(read());
      if (e.key === DEFAULT_KEY) setDefaults(readDefault());
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

  const saveDefault = useCallback((cfg: ExportDefaults) => {
    writeDefault(cfg);
    setDefaults(cfg);
  }, []);

  const clearDefault = useCallback(() => {
    writeDefault(null);
    setDefaults(null);
  }, []);

  /** Compara um item do histórico com o padrão atual. */
  const isDefaultEntry = useCallback(
    (entry: ExportHistoryEntry) => {
      if (!defaults) return false;
      const cfg: ExportDefaults = {
        title: entry.title,
        subtitle: entry.subtitle,
        period: entry.period,
        filtersText: entry.filtersText,
        includeCover: entry.includeCover,
        includeToc: entry.includeToc,
        includeWatermark: entry.includeWatermark,
        includeFooter: entry.includeFooter,
      };
      return sameDefaults(cfg, defaults);
    },
    [defaults],
  );

  const defaultEntry = useMemo(
    () => entries.find((e) => isDefaultEntry(e)) ?? null,
    [entries, isDefaultEntry],
  );

  return {
    entries,
    add,
    remove,
    clear,
    defaults,
    saveDefault,
    clearDefault,
    isDefaultEntry,
    defaultEntry,
  };
};
