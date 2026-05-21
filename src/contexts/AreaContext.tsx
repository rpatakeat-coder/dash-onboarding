import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export type AppArea = "onboarding" | "sucesso";

const STORAGE_KEY = "takeat:appArea";

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
  const [area, setAreaState] = useState<AppArea>(() => readStored());

  const setArea = useCallback((a: AppArea) => {
    setAreaState(a);
    try {
      window.localStorage.setItem(STORAGE_KEY, a);
    } catch {
      /* ignore */
    }
  }, []);

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
