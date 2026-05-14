import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X, Sparkles, Check } from "lucide-react";
import { TUTORIAL_STEPS } from "./steps";

interface Props {
  stepIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

interface Rect { top: number; left: number; width: number; height: number; }

const PADDING = 8;

export const TutorialOverlay = ({ stepIndex, onNext, onPrev, onClose }: Props) => {
  const step = TUTORIAL_STEPS[stepIndex];
  const [rect, setRect] = useState<Rect | null>(null);
  const [tick, setTick] = useState(0);

  // Find target element with retry (in case route just changed)
  useLayoutEffect(() => {
    if (!step || step.kind !== "spotlight" || !step.target) {
      setRect(null);
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const find = () => {
      if (cancelled) return;
      const el = document.querySelector(step.target!) as HTMLElement | null;
      if (!el) {
        attempts++;
        if (attempts < 30) setTimeout(find, 120);
        return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      // wait for scroll
      setTimeout(() => {
        if (cancelled) return;
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      }, 350);
    };
    find();
    return () => { cancelled = true; };
  }, [step, tick]);

  // Reposition on resize/scroll
  useEffect(() => {
    if (!step || step.kind !== "spotlight") return;
    const handler = () => setTick((t) => t + 1);
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [step]);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === "Enter") onNext();
      else if (e.key === "ArrowLeft") onPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNext, onPrev]);

  if (!step) return null;

  const total = TUTORIAL_STEPS.length;
  const isLast = stepIndex === total - 1;
  const isFirst = stepIndex === 0;
  const isModalLike = step.kind === "welcome" || step.kind === "finish" || !rect;

  // Tooltip position next to spotlight
  let tipStyle: React.CSSProperties = {};
  if (rect && step.kind === "spotlight") {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tipW = Math.min(380, vw - 32);
    const tipH = 200;
    const spaceBelow = vh - (rect.top + rect.height);
    const placeBelow = spaceBelow > tipH + 24 || rect.top < tipH + 24;
    let left = rect.left + rect.width / 2 - tipW / 2;
    left = Math.max(16, Math.min(left, vw - tipW - 16));
    const top = placeBelow ? rect.top + rect.height + PADDING + 12 : rect.top - PADDING - tipH - 12;
    tipStyle = { top: Math.max(16, top), left, width: tipW };
  }

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      {isModalLike ? (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-fade-in" />
      ) : rect ? (
        <>
          {/* 4-piece dimmed overlay around spotlight */}
          <div className="absolute bg-background/75 backdrop-blur-[2px] transition-all" style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top - PADDING) }} />
          <div className="absolute bg-background/75 backdrop-blur-[2px] transition-all" style={{ top: rect.top + rect.height + PADDING, left: 0, right: 0, bottom: 0 }} />
          <div className="absolute bg-background/75 backdrop-blur-[2px] transition-all" style={{ top: Math.max(0, rect.top - PADDING), left: 0, width: Math.max(0, rect.left - PADDING), height: rect.height + PADDING * 2 }} />
          <div className="absolute bg-background/75 backdrop-blur-[2px] transition-all" style={{ top: Math.max(0, rect.top - PADDING), left: rect.left + rect.width + PADDING, right: 0, height: rect.height + PADDING * 2 }} />
          {/* Spotlight ring */}
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-xl ring-2 ring-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.25)] transition-all"
            style={{ top: rect.top - PADDING, left: rect.left - PADDING, width: rect.width + PADDING * 2, height: rect.height + PADDING * 2 }}
          />
        </>
      ) : null}

      {/* Tooltip / modal card */}
      <div
        role="dialog"
        aria-label={step.title}
        className={
          isModalLike
            ? "absolute left-1/2 top-1/2 w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 animate-fade-in"
            : "absolute animate-fade-in"
        }
        style={isModalLike ? undefined : tipStyle}
      >
        <div className="rounded-2xl border border-border bg-card p-5 shadow-2xl">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {step.kind === "finish" ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              </span>
              <span className="font-subtitle text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Passo {stepIndex + 1} de {total}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar tutorial"
              className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <h3 className="font-display text-lg font-semibold text-foreground">{step.title}</h3>
          <p className="mt-1.5 font-subtitle text-sm leading-relaxed text-muted-foreground">{step.body}</p>

          {/* Progress dots */}
          <div className="mt-4 flex items-center gap-1">
            {TUTORIAL_STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === stepIndex ? "w-6 bg-primary" : i < stepIndex ? "w-1.5 bg-primary/50" : "w-1.5 bg-muted"}`}
              />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              className="font-subtitle text-xs text-muted-foreground hover:text-foreground"
            >
              Pular tour
            </button>
            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  type="button"
                  onClick={onPrev}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 font-subtitle text-xs font-medium text-foreground transition hover:bg-muted"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Voltar
                </button>
              )}
              <button
                type="button"
                onClick={onNext}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 font-subtitle text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                {isLast ? "Concluir" : "Próximo"}
                {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
