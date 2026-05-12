export type InsightType =
  | "executive"
  | "risks"
  | "opportunities"
  | "operators"
  | "trends";

export const INSIGHT_TYPE_LABELS: Record<InsightType, string> = {
  executive: "Executivo",
  risks: "Riscos",
  opportunities: "Oportunidades",
  operators: "Operadores",
  trends: "Tendências",
};

/**
 * Default templates MUST stay in sync with `SECTIONS` in
 * `supabase/functions/ai-insights/index.ts`.
 * Edit both places when changing defaults.
 */
export const DEFAULT_INSIGHT_TEMPLATES: Record<InsightType, string> = {
  executive: [
    "## Resumo executivo",
    "- 3 a 5 bullets curtos explicando o estado da operação e principais variações vs snapshot anterior. Quando houver delta relevante, explique a causa provável a partir dos dados.",
    "",
    "## Sugestões de ação por operador",
    "- Liste até 5 operadores prioritários. Para cada um: **Nome** — ação recomendada concreta em 1 frase. Não invente operadores fora do payload.",
  ].join("\n"),
  risks: [
    "## Riscos e alertas",
    "- Liste 3 a 6 riscos prioritários (SLA estourado, concentração de carteira, queda de % no prazo, deals parados). Para cada risco: **Risco** — evidência nos dados — impacto estimado.",
    "",
    "## Mitigações imediatas",
    "- Até 5 ações em ordem de prioridade. Cada uma: **Ação** — responsável sugerido (operador do payload, se aplicável) — prazo curto.",
  ].join("\n"),
  opportunities: [
    "## Oportunidades de aceleração",
    "- 3 a 5 oportunidades visíveis nos dados (operadores com folga de carteira, KPIs em alta sustentável, deals próximos de conversão). Para cada uma: **Oportunidade** — evidência — ganho potencial.",
    "",
    "## Próximos passos",
    "- Até 4 ações práticas para capturar essas oportunidades nesta semana.",
  ].join("\n"),
  operators: [
    "## Diagnóstico por operador",
    "- Para cada operador relevante (até 8): **Nome** — leitura curta da carteira (ativos, críticos, SLA médio) — pontos fortes e fracos.",
    "",
    "## Ações recomendadas",
    "- Para cada operador citado acima, 1 ação concreta priorizada. Formato: **Nome** — ação.",
  ].join("\n"),
  trends: [
    "## Tendências observadas",
    "- 3 a 5 bullets comparando KPIs atuais com o snapshot anterior. Destaque variações relevantes e padrões (melhora, piora, estabilidade).",
    "",
    "## Projeção e atenção",
    "- 2 a 4 bullets com projeção qualitativa para os próximos dias e o que monitorar de perto. Não invente números futuros.",
  ].join("\n"),
};

const STORAGE_KEY = "ai-insights:templates:v1";

export type TemplateOverrides = Partial<Record<InsightType, string>>;

export function loadTemplateOverrides(): TemplateOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as TemplateOverrides;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveTemplateOverrides(overrides: TemplateOverrides) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    // Notify same-tab listeners
    window.dispatchEvent(new CustomEvent("ai-insights:templates-changed"));
  } catch {
    /* ignore quota */
  }
}

export function getEffectiveTemplate(
  type: InsightType,
  overrides: TemplateOverrides,
): string {
  const o = overrides[type];
  return o && o.trim() ? o : DEFAULT_INSIGHT_TEMPLATES[type];
}
