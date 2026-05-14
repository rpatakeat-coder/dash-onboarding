export interface TutorialStep {
  kind?: "welcome" | "spotlight" | "finish";
  route?: string;
  target?: string;
  title: string;
  body: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    kind: "welcome",
    route: "/",
    title: "Bem-vindo ao Painel de Onboarding",
    body: "Vamos fazer um tour rápido pelas principais áreas do sistema. Em menos de 1 minuto você conhece tudo que importa para acompanhar a operação.",
  },
  {
    kind: "spotlight",
    route: "/",
    target: '[data-tour="nav"]',
    title: "Navegação principal",
    body: "Alterne entre Visão geral, Gestão, Minha carteira e Modo TV. O item ativo fica destacado.",
  },
  {
    kind: "spotlight",
    route: "/",
    target: '[data-tour="filters"] [role="combobox"], [data-tour="filters"] button',
    title: "Filtros do período",
    body: "Refine o que aparece nos KPIs e gráficos por ativador e etapa do funil. Os filtros aplicam para todo o dashboard.",
  },
  {
    kind: "spotlight",
    route: "/",
    target: '[data-tour="ai-insights"]',
    title: "Insights de IA",
    body: "Gere uma leitura analítica do período atual com recomendações automáticas.",
  },
  {
    kind: "spotlight",
    route: "/",
    target: '[data-tour="copilot"]',
    title: "Copiloto de Operações",
    body: "Pergunte em linguagem natural sobre deals, KPIs, ativadores e comparações de período. Use as ações rápidas para começar.",
  },
  {
    kind: "spotlight",
    route: "/",
    target: '[data-tour="kpis"] section',
    title: "KPIs de MRR ativado",
    body: "Acompanhe o MRR ativado do período, ticket médio e a evolução comparada ao mês anterior.",
  },
  {
    kind: "spotlight",
    route: "/",
    target: '[data-tour="deals-header"]',
    title: "Tabela de deals",
    body: "Lista completa dos deals com SLA, etapa e responsável. Clique em qualquer linha para abrir o detalhe.",
  },
  {
    kind: "spotlight",
    route: "/minha-carteira",
    target: '[data-tour="carteira-title"]',
    title: "Minha carteira",
    body: "Visão pessoal: só os deals sob sua responsabilidade, com KPIs próprios e ranking de prioridade.",
  },
  {
    kind: "spotlight",
    route: "/tv",
    target: '[data-tour="tv-header"]',
    title: "Modo TV",
    body: "Tela cheia com slides rotativos para acompanhar a operação ao vivo. Ideal para a TV do time.",
  },
  {
    kind: "finish",
    route: "/",
    title: "Pronto!",
    body: "Você pode reabrir esse tutorial a qualquer momento em Preferências → Tutorial. Bom trabalho!",
  },
];
