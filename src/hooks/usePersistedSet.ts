import { useEffect, useState } from "react";

/**
 * useState<Set<string>> que persiste no localStorage sob `key`.
 * Mantém o mesmo formato de API do useState para uso direto em filtros.
 */
export function usePersistedSet(key: string, initial: string[] = []): [Set<string>, (next: Set<string>) => void] {
  const [value, setValue] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set(initial);
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return new Set(initial);
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? new Set(arr.filter((v) => typeof v === "string")) : new Set(initial);
    } catch {
      return new Set(initial);
    }
  });

  useEffect(() => {
    try {
      if (value.size === 0) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, JSON.stringify(Array.from(value)));
    } catch {
      /* storage indisponível — ignora */
    }
  }, [key, value]);

  return [value, setValue];
}
