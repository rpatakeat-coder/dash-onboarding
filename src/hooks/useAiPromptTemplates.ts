import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_INSIGHT_TEMPLATES,
  TemplateOverrides,
  InsightType,
  getEffectiveTemplate,
  loadTemplateOverrides,
  saveTemplateOverrides,
} from "@/lib/aiPromptTemplates";

export function useAiPromptTemplates() {
  const [overrides, setOverrides] = useState<TemplateOverrides>(() => loadTemplateOverrides());

  useEffect(() => {
    const sync = () => setOverrides(loadTemplateOverrides());
    window.addEventListener("storage", sync);
    window.addEventListener("ai-insights:templates-changed", sync as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("ai-insights:templates-changed", sync as EventListener);
    };
  }, []);

  const setTemplate = useCallback((type: InsightType, value: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      const trimmed = value.trim();
      if (!trimmed || trimmed === DEFAULT_INSIGHT_TEMPLATES[type]) {
        delete next[type];
      } else {
        next[type] = value;
      }
      saveTemplateOverrides(next);
      return next;
    });
  }, []);

  const resetTemplate = useCallback((type: InsightType) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[type];
      saveTemplateOverrides(next);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setOverrides({});
    saveTemplateOverrides({});
  }, []);

  const getTemplate = useCallback(
    (type: InsightType) => getEffectiveTemplate(type, overrides),
    [overrides],
  );

  const isCustom = useCallback(
    (type: InsightType) => Boolean(overrides[type] && overrides[type]!.trim()),
    [overrides],
  );

  return { overrides, getTemplate, setTemplate, resetTemplate, resetAll, isCustom };
}
