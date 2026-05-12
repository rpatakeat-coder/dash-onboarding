# Mais profundidade no Insights da IA

Três recursos novos, todos no painel de Insights e no modal "Explicar KPI". Sem mudanças de schema — tudo aproveita a edge function `ai-insights` e o histórico de versões já existente em sessionStorage.

## 1. Comparar duas versões lado a lado

**O que muda na UI**
- No `AiInsightsCard` e no `ExplainKpiDialog`, quando houver 2+ versões no histórico, surge o botão **"Comparar"** ao lado do seletor de versões.
- Abre um diálogo amplo (`max-w-5xl`) com duas colunas:
  - Esquerda: versão âncora (default = mais antiga visível).
  - Direita: versão comparada (default = mais nova/atual).
- Cada coluna mostra: timestamp, modelo, foco aplicado (se houver), conteúdo em Markdown.
- Acima das colunas, dois `Select` permitem trocar quais versões comparar.
- Toggle **"Realçar diferenças"** que aplica `diff` por linha (verde = adicionado, vermelho = removido) usando a lib `diff` (~10kb). Quando desligado, exibe markdown puro lado a lado.
- Em telas estreitas (<768px), as colunas viram tabs.

**Onde toca**
- Novo: `src/components/dashboard/AiVersionsCompareDialog.tsx`.
- Editar: `AiInsightsCard.tsx` e `ExplainKpiDialog.tsx` (ler `versions` do hook, abrir o diálogo).
- Dependência nova: `diff`.

## 2. Modal de análise focada por operador

**O que muda na UI**
- `OperatorsTable.tsx` ganha um botão Sparkles em cada linha (mesmo padrão do `KpiCard`), visível em hover, com `aria-label="Analisar operador com IA"`.
- Clicar abre `OperatorInsightDialog` (novo), que reusa `useAiInsights` em modo `"dashboard"` com:
  - `insightType` fixo em `"operators"`.
  - `operadores` reduzido a apenas o operador clicado.
  - `kpis` enviados são os do operador (ativos, críticos, sla médio, mrr) + um resumo agregado da operação para contexto.
  - `cacheKey` próprio: `dashboard:operator:<nome>:<scopeKey>` — não polui o cache do painel principal.
- Layout do modal: cabeçalho com nome do operador, badges (ativos / críticos / SLA), conteúdo gerado pela IA, mesmos botões de **Regenerar / Copiar / Exportar** (item 3) e o seletor de **Histórico** já existente.

**Onde toca**
- Novo: `src/components/dashboard/OperatorInsightDialog.tsx`.
- Editar: `OperatorsTable.tsx` (botão + estado do dialog), `Index.tsx` se precisar passar contexto agregado.
- Edge function `ai-insights`: já aceita `insightType: "operators"`, sem alteração de schema. Apenas garantir que o prompt funciona bem com 1 único operador no payload (ele já não inventa nomes).

## 3. Exportar insight em PDF e Markdown

**O que muda na UI**
- Novo componente utilitário `AiExportMenu` (DropdownMenu com 3 itens: "Copiar como Markdown", "Baixar .md", "Baixar PDF").
- Aparece no rodapé/cabeçalho de:
  - `AiInsightsCard` (substitui o botão "Atualizar" duplicado por um menu próprio).
  - `ExplainKpiDialog`.
  - `OperatorInsightDialog`.
  - `AiVersionsCompareDialog` (exporta as 2 versões num único arquivo).

**Como geramos**
- **Markdown**: serializa cabeçalho (título, escopo, timestamp, modelo, foco) + conteúdo. Para comparação, dois blocos `## Versão A` / `## Versão B`.
- **PDF**: usar `jspdf` + `html2canvas` (já presentes no projeto pelo `ExportPdfButton.tsx`). Renderizamos um nó oculto com o markdown convertido (via `react-markdown` + `renderToString`) e a marca Takeat do `pdfBranding.ts`. Mantemos uma página A4, header com logo + título "Insights da IA — {tipo}", footer com data/hora.

**Onde toca**
- Novo: `src/components/dashboard/AiExportMenu.tsx`, `src/lib/aiInsightExport.ts` (helpers `toMarkdown`, `toPdf`).
- Editar: os três componentes acima para incluir o menu.
- Sem dependências novas (jspdf, html2canvas e react-markdown já existem).

## Detalhes técnicos comuns

- Histórico já é mantido por `useAiInsights` (até 5 versões/`cacheKey`, TTL 10 min). Os recursos 1 e 3 só consomem; o recurso 2 cria suas próprias `cacheKey`s.
- Auditoria: cada exportação registra entrada em `audit_logs` via `src/lib/audit.ts` (`action: "ai_insights_exported"`, metadata com `format` e `mode`). Sem nova RLS — política de insert existente cobre.
- Rate limit da edge function permanece em 10 req/min/usuário; os novos modais reaproveitam cache antes de chamar a IA.
- Acessibilidade: todos os botões com `aria-label`, modais com foco inicial no botão primário, navegação por teclado nas tabs do compare.

## Fora do escopo (para iteração futura)

- Sincronizar histórico no Supabase (hoje fica em sessionStorage).
- Diff semântico (comparação por trecho ao invés de por linha).
- Exportar análise consolidada de vários operadores em um único PDF.
