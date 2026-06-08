## Contexto

A função `isChurnRow` em `src/hooks/useDashOperacoes.ts` **já** considera apenas `etapa_negocio = "Churn"` (mais `pipeline_nome = "Sucesso"` e `etapa_de_cancelamento = "Onboarding"`). Portanto o cálculo já está correto — minha explicação anterior mencionando "Pré-Churn/Pré-Cancelamento/Cancelamento" estava errada e não reflete o código.

O problema é que **comentários e tooltips na UI** ainda dizem "Pré-Churn/Churn/Cancelamento", o que confunde a leitura.

## O que mudar (apenas texto, sem mexer em lógica)

1. `src/hooks/useDashOperacoes.ts` linha 50 — JSDoc do campo `churnReal`:
   - de: `MRR dos deals em Pré-Churn/Churn/Cancelamento com data_fechamento no mês vigente.`
   - para: `MRR dos deals em etapa "Churn" (pipeline Sucesso, origem Onboarding) com data_fechamento no mês vigente.`

2. `src/components/dashboard/RastroMensal.tsx` linha 126 — texto do `InfoTooltip`:
   - de: `... % Churn Onboarding = MRR de deals em Pré-Churn/Churn/Cancelamento fechados no mês ÷ MRR criado no mês × 100.`
   - para: `... % Churn Onboarding = MRR de deals em etapa "Churn" (pipeline Sucesso, origem Onboarding) fechados no mês ÷ MRR criado no mês × 100.`

## O que NÃO muda

- `isChurnRow` continua igual (etapa exata `Churn`).
- `computeChurnKpis`, `ChurnKpis.tsx`, `RastroMensal.tsx` (lógica de cálculo) — nada a alterar.
- Referências a `Pré-Cancelamento` em `DealDrawer.tsx`, `AttentionPoints.tsx` e `useDashOperacoes.ts:599` são de outras features (etapas exibidas em listas/ícones) e não fazem parte do cálculo de churn — ficam como estão.