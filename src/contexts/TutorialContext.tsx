import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { TutorialOverlay } from "@/components/tutorial/TutorialOverlay";
import { TUTORIAL_STEPS } from "@/components/tutorial/steps";

const storageKey = (uid?: string | null) => `tutorial:v1:done:${uid ?? "anon"}`;

interface Ctx {
  start: () => void;
  stop: () => void;
  active: boolean;
  stepIndex: number;
  next: () => void;
  prev: () => void;
}

const TutorialContext = createContext<Ctx | null>(null);

export const TutorialProvider = ({ children }: { children: ReactNode }) => {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const { session, loading, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const uid = user?.id ?? null;

  const markDone = useCallback(() => {
    try { localStorage.setItem(storageKey(uid), "1"); } catch { /* noop */ }
  }, [uid]);

  const start = useCallback(() => {
    setStepIndex(0);
    setActive(true);
  }, []);

  const stop = useCallback(() => {
    setActive(false);
    markDone();
  }, [markDone]);

  const next = useCallback(() => {
    setStepIndex((i) => {
      const ni = i + 1;
      if (ni >= TUTORIAL_STEPS.length) {
        setActive(false);
        markDone();
        return i;
      }
      return ni;
    });
  }, [markDone]);

  const prev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  // Auto-start only on first access ever for this user
  useEffect(() => {
    if (loading || !session || !uid) return;
    if (location.pathname === "/auth" || location.pathname === "/acesso-dash") return;
    let done = false;
    try {
      done = !!localStorage.getItem(storageKey(uid))
        // legacy key migration
        || !!localStorage.getItem("tutorial:v1:done");
    } catch { /* noop */ }
    if (!done) {
      const t = setTimeout(() => start(), 600);
      return () => clearTimeout(t);
    }
  }, [loading, session, uid, location.pathname, start]);

  // Sync route with step
  useEffect(() => {
    if (!active) return;
    const step = TUTORIAL_STEPS[stepIndex];
    if (!step?.route) return;
    if (location.pathname !== step.route) {
      navigate(step.route);
    }
  }, [active, stepIndex, location.pathname, navigate]);

  return (
    <TutorialContext.Provider value={{ start, stop, active, stepIndex, next, prev }}>
      {children}
      {active && <TutorialOverlay stepIndex={stepIndex} onNext={next} onPrev={prev} onClose={stop} />}
    </TutorialContext.Provider>
  );
};

export const useTutorial = () => {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error("useTutorial must be used within TutorialProvider");
  return ctx;
};
