import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useLocation } from "react-router-dom";

export type AppArea = "onboarding" | "sucesso";

const STORAGE_KEY = "takeat:appArea";

/**
 * Deriva a área a partir do pathname. A URL é a fonte da verdade para rotas
 * específicas de cada área; rotas neutras (/admin, /tv, ...) retornam null e
 * mantêm a área atual/preferida.
 */
const areaFromPath = (pathname: string): AppArea | null => {
  if (pathname === "/sucesso" || pathname.startsWith("/sucesso/")) return "sucesso";
  if (pathname === "/" || pathname === "/minha-carteira") return "onboarding";
  return null;
};

interface AreaContextValue {
  area: AppArea;
  setArea: (a: AppArea) => void;
}

const AreaContext = createContext<AreaContextValue | undefined>(undefined);

const readStored = (): AppArea => {
  if (typeof window === "undefined") return "onboarding";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "sucesso" ? "sucesso" : "onboarding";
};

export const AreaProvider = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  // Inicializa pela URL (fonte da verdade) e cai no preferido salvo se for neutra.
  const [area, setAreaState] = useState<AppArea>(() => areaFromPath(typeof window !== "undefined" ? window.location.pathname : "/") ?? readStored());

  const setArea = useCallback((a: AppArea) => {
    setAreaState(a);
    try {
      window.localStorage.setItem(STORAGE_KEY, a);
    } catch {
      /* ignore */
    }
  }, []);

  // A URL manda: ao navegar para uma rota de área (por qualquer caminho —
  // links, voltar/avançar, URL direta), o rótulo acompanha. Persiste a escolha.
  useEffect(() => {
    const fromPath = areaFromPath(pathname);
    if (fromPath) setArea(fromPath);
  }, [pathname, setArea]);

  // Sync if changed from another tab
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setAreaState(readStored());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(() => ({ area, setArea }), [area, setArea]);
  return <AreaContext.Provider value={value}>{children}</AreaContext.Provider>;
};

export const useArea = () => {
  const ctx = useContext(AreaContext);
  if (!ctx) throw new Error("useArea must be used within AreaProvider");
  return ctx;
};

export const AREA_LABELS: Record<AppArea, string> = {
  onboarding: "Onboarding",
  sucesso: "Sucesso",
};
