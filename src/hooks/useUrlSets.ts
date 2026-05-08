import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Sincroniza um conjunto de filtros (Set<string> + booleans) com a URL via searchParams.
 * Cada chave em `defs.sets` vira `?key=val1,val2`. Cada chave em `defs.flags` vira `?key=1`.
 */
export function useUrlSets<
  S extends Record<string, Set<string>>,
  F extends Record<string, boolean>,
>(
  sets: S,
  setSets: { [K in keyof S]: (v: Set<string>) => void },
  flags: F,
  setFlags: { [K in keyof F]: (v: boolean) => void },
) {
  const [params, setParams] = useSearchParams();
  const initialized = useRef(false);

  // Hidrata estado a partir da URL na primeira render
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    for (const k of Object.keys(sets) as (keyof S)[]) {
      const raw = params.get(String(k));
      if (raw) setSets[k](new Set(raw.split(",").filter(Boolean)));
    }
    for (const k of Object.keys(flags) as (keyof F)[]) {
      if (params.get(String(k)) === "1") setFlags[k](true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza estado → URL
  useEffect(() => {
    if (!initialized.current) return;
    const next = new URLSearchParams(params);
    for (const k of Object.keys(sets) as (keyof S)[]) {
      const arr = [...sets[k]];
      if (arr.length) next.set(String(k), arr.join(","));
      else next.delete(String(k));
    }
    for (const k of Object.keys(flags) as (keyof F)[]) {
      if (flags[k]) next.set(String(k), "1");
      else next.delete(String(k));
    }
    if (next.toString() !== params.toString()) {
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ...Object.values(sets).map((s) => [...s].join(",")),
    ...Object.values(flags),
  ]);
}
