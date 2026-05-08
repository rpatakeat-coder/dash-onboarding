## Objetivo

Dar a cada ativador uma visão clara da própria carteira, com priorização imediata por **faixas de SLA** representadas por cores. O usuário consegue ver, em um único cartão por operador, quantos clientes ele tem em cada faixa e quais são — começando pelos mais críticos.

## Faixas de SLA e cores

| Faixa | Regra (sla_dias) | Cor (token) |
|---|---|---|
| Crítico | > 30 dias | `destructive` (vermelho) |
| Atenção | = 30 dias | `warning` / laranja |
| Alerta | 21–29 dias | `accent` / amarelo |
| Saudável | ≤ 20 dias | `success` (verde) |

Os tokens já existem no design system; novos tons (laranja/amarelo distintos) serão adicionados em `index.css` se necessário para diferenciar visualmente do amarelo/vermelho atuais.

## O que muda na UI

### 1. Tabela "Performance por ativador" — barra empilhada
Cada linha de operador ganha, no lugar (ou abaixo) da barra azul atual, uma **barra empilhada de 4 segmentos** proporcionais à carteira do operador, na ordem: vermelho · laranja · amarelo · verde. Tooltip em cada segmento mostra "X clientes · faixa Y".

Indicadores extras inline ao lado do nome:
- contagem por faixa em chips coloridos pequenos (ex.: `🔴 4 · 🟠 2 · 🟡 7 · 🟢 18`)
- destaque visual sutil (borda/anel vermelho) quando o operador tem >0 clientes na faixa crítica

### 2. Modal "Carteira do operador" (clique na linha)
Ao clicar em uma linha de operador abre um modal com:

- **Header**: nome do operador, total de clientes, MRR sob gestão, SLA médio
- **Barra empilhada grande** com legenda das 4 faixas
- **Lista agrupada por faixa**, ordem fixa (Crítico → Atenção → Alerta → Saudável). Cada faixa tem:
  - cabeçalho com cor da faixa, nome, contagem e MRR somado
  - lista dos clientes daquela faixa: nome · etapa · perfil · SLA (dias) · MRR
  - colapsável (faixas saudáveis começam recolhidas)
- Reaproveita estilo do `EstoqueModal` (busca, ordenação)

Estrutura visual do modal:

```text
┌──────────────────────────────────────────────┐
│ Maria Silva · 31 clientes · R$ 18k · 22d     │
│ [████|██|███████|████████████]               │
│  4    2    7         18                      │
├──────────────────────────────────────────────┤
│ ▼ 🔴 Crítico (>30d) · 4 clientes · R$ 6k     │
│   • Cliente X · Setup · M · 42d · R$ 1.2k    │
│   • ...                                      │
│ ▼ 🟠 Atenção (=30d) · 2 · R$ 1k              │
│ ▼ 🟡 Alerta (21–29d) · 7 · R$ 4k             │
│ ▶ 🟢 Saudável (≤20d) · 18 · R$ 7k            │
└──────────────────────────────────────────────┘
```

### 3. Filtros já existentes continuam valendo
Os filtros globais de Ativador/Etapa e o filtro de período de "Performance por ativador" alimentam tanto a tabela empilhada quanto o conteúdo do modal — ou seja, o operador vê sua carteira respeitando o recorte ativo.

## Detalhes técnicos

- Estender `OperatorStat` em `useDashOperacoes.ts` com:
  - `bands: { critico: number; atencao: number; alerta: number; saudavel: number }`
  - `bandsMrr: { ... }` (mesmas chaves)
  - `clientes: { cliente: string; etapa: string; perfil: string; sla: number; mrr: number; band: BandKey }[]` para alimentar o modal sem refazer a query
- Função `slaBand(dias: number): BandKey` compartilhada
- Ajuste em `computeFiltered` (já filtra por período/global) para popular esses campos por operador
- Novo componente `src/components/dashboard/OperatorCarteiraModal.tsx`
- Novo componente `src/components/dashboard/SlaBandBar.tsx` (barra empilhada reutilizável — usada inline na tabela e em escala maior no modal)
- `OperatorsTable` passa a receber `onOperatorClick` e abrir o modal a partir de `Index.tsx`
- Tokens: usar `--success`, `--warning`, `--destructive` existentes; adicionar `--sla-alerta` (amarelo) e `--sla-atencao` (laranja) em `index.css` se as cores atuais não derem contraste suficiente entre as quatro faixas

## Fora do escopo
- Login por operador / view filtrada automaticamente para o usuário logado
- Exportação (CSV/Excel) da carteira
- Histórico de evolução do SLA por operador
