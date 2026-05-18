## Objetivo
Evoluir a página Gestão (`/gestao`, admin) para um workspace de cobrança individual: ver rápido quem está fora da curva, comparar ativadores, acompanhar tendência e exportar o que estiver na tela.

Tudo é puramente frontend — consome o que `useDashOperacoes` já entrega (mais `dash_operacoes_snapshots` para o histórico) e respeita os filtros globais (período, ativadores, etapas) que já existem em `Index.tsx`.

## Bloco 1 — Alertas automáticos de gestão (topo da página)

Faixa de cards acima da "Visão gerencial por operador", com 4 alertas calculados sobre `rows` filtrados:

- **Operadores em queda** — ativações desta semana vs. semana anterior; lista os que caíram >30%.
- **Deals parados >30d** — `sla_dias_etapa > 30`, agrupado por ativador (top 3 por contagem).
- **MRR crítico parado** — soma de MRR de deals com `band = critico`, por ativador (top 3 por R$).
- **Sem movimento há 14d** — deals cuja `data_entrada_fase` é > 14d, por ativador.

Cada card:
- número grande + rótulo
- até 3 chips com `nome · valor` clicáveis → seta o filtro de ativador no topo e rola até a tabela
- cor da borda usa tokens semânticos (`destructive`, `warning`, `primary`)

Arquivo novo: `src/components/dashboard/GestaoAlerts.tsx`.

## Bloco 2 — Tendência semanal de ativações por operador

Componente abaixo dos alertas:

- Sparkline (recharts `LineChart` mini, já usado no projeto) das últimas **8 semanas** por ativador, derivado de `dash_operacoes` (`data_ativacao` agrupada por semana ISO).
- Tabela compacta: ativador · barras semanais · total 8s · variação % última semana vs. média das 7 anteriores, com seta ↑/↓ colorida.
- Ordenação: maior queda primeiro (combina com foco de cobrança).
- Clicar na linha seleciona o operador na seção gerencial já existente.

Arquivo novo: `src/components/dashboard/TrendByOperator.tsx`.

## Bloco 3 — Comparativo entre operadores (benchmark)

- Botão "Comparar" abre um `Sheet` lateral.
- Multi-seleção de 2–4 ativadores (reusa `MultiSelectFilter`).
- Mostra grid lado a lado com: ativos, MRR sob gestão, % no prazo, SLA médio, distribuição de bands (mini `SlaBandBar`), mix de perfis P/M/G/GG, ativações últimos 30d, deals críticos.
- Coluna do "campeão" de cada métrica recebe destaque sutil (`ring-1 ring-primary/40`).

Arquivo novo: `src/components/dashboard/OperatorCompareSheet.tsx`.

## Bloco 4 — Exportar relatório (PDF/CSV)

Botão no header da Gestão com `DropdownMenu`:

- **Exportar CSV** — gera CSV do ranking atual (operador, ativos, mrr, criticos, atencao, alerta, saudaveis, sla_medio, pct_no_prazo) usando `Blob` + `URL.createObjectURL`. Nome: `gestao_<periodo>_<YYYY-MM-DD>.csv`.
- **Exportar PDF** — usa `jspdf` + `jspdf-autotable` (precisa instalar) para gerar PDF com cabeçalho (filtros aplicados, total de clientes, MRR sob gestão) + tabela do ranking + bloco de alertas. Tudo client-side, respeitando filtros atuais.

Arquivo novo: `src/lib/exportGestao.ts` com `toCSV(rows)` e `toPDF(rows, meta)`.

## Detalhes técnicos

- **Sem mudanças no banco** — toda a lógica é derivada do que já vem de `dash_operacoes`. `dash_operacoes_snapshots` é opcional (não vou usar nesta entrega, fica para uma futura "evolução de carteira").
- **Filtros globais respeitados** — todos os blocos consomem `rows` já filtrado por ativador/etapa vindo do `Index.tsx`, igual a `ManagerialView`.
- **Cores/tipografia** — somente tokens semânticos de `index.css` (`destructive`, `warning`, `success`, `primary`, `muted-foreground`) e fontes já configuradas (`font-display`, `font-numeric`, `font-subtitle`).
- **Persistência** — seleção do "Comparar" persiste em `localStorage` via `usePersistedSet` (mesmo padrão dos outros filtros).
- **Admin-only** — a página Gestão já é restrita a `isAdmin`, sem mudança.
- **Dependência nova**: `jspdf` + `jspdf-autotable` (~70KB gz). Se preferir não instalar, dá pra entregar só o CSV agora e o PDF numa segunda iteração — me avise.

## Estrutura final da página Gestão

```text
┌────────────────────────────────────────────────────┐
│  Cabeçalho (filtros globais já existentes)         │
│  [Comparar ▾] [Exportar ▾]    ← novos botões      │
├────────────────────────────────────────────────────┤
│  GestaoAlerts (4 cards de alerta)         ← novo  │
├────────────────────────────────────────────────────┤
│  TrendByOperator (tendência 8 semanas)    ← novo  │
├────────────────────────────────────────────────────┤
│  ManagerialView (ranking + drill atual)           │
└────────────────────────────────────────────────────┘
```

## Ordem de implementação

1. `GestaoAlerts` + integração no `Index.tsx` (impacto imediato visual e de cobrança).
2. Exportar CSV (rápido, sem dep).
3. `TrendByOperator`.
4. `OperatorCompareSheet`.
5. Exportar PDF (instala `jspdf`).

Posso fazer tudo numa entrega só ou quebrar em passos — se quiser quebrar, recomendo entregar 1+2 primeiro pra você usar e validar a régua dos alertas antes de avançar.
