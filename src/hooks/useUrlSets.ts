import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

type Sets = Record<string, Set<string>>;
type Flags = Record<string, boolean>;

/**
 * Sincroniza filtros (Set<string>) e flags (boolean) com a URL.
 * Hidrata o estado da URL no mount e escreve de volta a cada mudança.
 */
export function useUrlSets(
  sets: Sets,
  setSets: Record<string, (v: Set<string>) => void>,
  flags: Flags,
  setFlags: Record<string, (v: boolean) => void>,
) {
  const [params, setParams] = useSearchParams();
  const hydrated = useRef(false);

  // Hidrata uma vez na montagem
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    for (const k of Object.keys(sets)) {
      const raw = params.get(k);
      if (raw) setSets[k](new Set(raw.split(",").filter(Boolean)));
    }
    for (const k of Object.keys(flags)) {
      if (params.get(k) === "1") setFlags[k](true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Serializa estado atual num string estável e usa como dep única
  const serialized =
    Object.entries(sets)
      .map(([k, v]) => `${k}=${[...v].sort().join(",")}`)
      .join("|") +
    "::" +
    Object.entries(flags)
      .map(([k, v]) => `${k}=${v ? "1" : "0"}`)
      .join("|");

  useEffect(() => {
    if (!hydrated.current) return;
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(sets)) {
      const arr = [...v];
      if (arr.length) next.set(k, arr.join(","));
      else next.delete(k);
    }
    for (const [k, v] of Object.entries(flags)) {
      if (v) next.set(k, "1");
      else next.delete(k);
    }
    if (next.toString() !== params.toString()) {
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);
}
