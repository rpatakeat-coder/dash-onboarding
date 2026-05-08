import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type Density = "comfortable" | "compact";
export type HomeRoute = "/" | "/minha-carteira" | "/tv";

export interface NotifToggles {
  slaCritico: boolean;
  parado: boolean;
  meta: boolean;
}

export interface Preferences {
  theme: ThemeMode;
  density: Density;
  homeRoute: HomeRoute;
  notif: NotifToggles;
}

const DEFAULTS: Preferences = {
  theme: "system",
  density: "comfortable",
  homeRoute: "/",
  notif: { slaCritico: true, parado: true, meta: true },
};

const STORAGE_KEY = "prefs:v1";

interface Ctx extends Preferences {
  setTheme: (t: ThemeMode) => void;
  setDensity: (d: Density) => void;
  setHomeRoute: (r: HomeRoute) => void;
  setNotif: (n: Partial<NotifToggles>) => void;
  cycleTheme: () => void;
}

const PreferencesContext = createContext<Ctx | null>(null);

const load = (): Preferences => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed, notif: { ...DEFAULTS.notif, ...(parsed.notif ?? {}) } };
  } catch {
    return DEFAULTS;
  }
};

const applyTheme = (theme: ThemeMode) => {
  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
};

const applyDensity = (d: Density) => {
  document.documentElement.dataset.density = d;
};

export const PreferencesProvider = ({ children }: { children: ReactNode }) => {
  const [prefs, setPrefs] = useState<Preferences>(() => {
    if (typeof window === "undefined") return DEFAULTS;
    return load();
  });

  useEffect(() => {
    applyTheme(prefs.theme);
    applyDensity(prefs.density);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  useEffect(() => {
    if (prefs.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = () => applyTheme("system");
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [prefs.theme]);

  const value: Ctx = {
    ...prefs,
    setTheme: (theme) => setPrefs((p) => ({ ...p, theme })),
    setDensity: (density) => setPrefs((p) => ({ ...p, density })),
    setHomeRoute: (homeRoute) => setPrefs((p) => ({ ...p, homeRoute })),
    setNotif: (n) => setPrefs((p) => ({ ...p, notif: { ...p.notif, ...n } })),
    cycleTheme: () =>
      setPrefs((p) => ({
        ...p,
        theme: p.theme === "light" ? "dark" : p.theme === "dark" ? "system" : "light",
      })),
  };

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
};

export const usePreferences = () => {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
};
