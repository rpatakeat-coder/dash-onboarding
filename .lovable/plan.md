## Objetivo

Substituir o dashboard atual (`/`) por uma visão enxuta dividida em **dois blocos**:

1. **Macros** — quadros agregados (estoque, perfis, SLA, novos, ativações, carteira por ativador).
2. **Lista linha-a-linha** — tabela filtrável (SLA, fase, ativador, perfil).

A página antiga (Highlights, Heatmap, RiskRanking, ManagerialView, Trend, Funnel etc.) será removida da rota `/`. Os componentes ficam no projeto para reuso futuro, mas saem do `Index.tsx`.

---

## Bloco 1 — Quadros macro

### Linha A — Estoque
- **Total em estoque** (count de `dash_operacoes`).
- **Distribuição P / M / G / GG** — quantidade + % (já existe via `perfis`, manter).

### Linha B — SLA do estoque (criação)
- **P75 (dias)** sobre `sla_dias_criacao`.
- **Média (dias)** sobre `sla_dias_criacao`.
- **% SLA > 30 dias** e **% SLA ≤ 30 dias** (sobre `sla_dias_criacao`, não mais sobre `sla_dias_etapa`).
- ⚠️ Sem desconto de pausa nesta primeira entrega — ver seção "Pendência: desconto de pausados".

### Linha C — Movimento
- **Novos clientes hoje** (criados hoje).
- **MRR ativado hoje** (R$ + nº de deals que estão em `Acompanhamento` criados hoje).
- **MRR ativado semana** (R$ + nº).
- **MRR ativado mês atual** (R$ + nº).
- **MRR ativado mês anterior** (R$ + nº).
- Conforme escolhido: **só valores absolutos**, sem percentual.

### Linha D — Carteira por ativador
- Lista compacta: nome do ativador + nº de clientes em carteira.
- Ordenada por carteira desc.
- Para usuário ativador (não-admin): só aparece a própria linha (já garantido por RLS).

---

## Bloco 2 — Lista linha-a-linha

Tabela única substituindo as listas espalhadas (Stalled, RiskRanking etc.).

**Colunas**:
- Nome do negócio (`nome_negocio`) — clicável, abre o `DealDrawer` existente.
- Etapa (`etapa_negocio`).
- SLA criação (`sla_dias_criacao`) — com badge de cor por faixa.
- SLA fase (`sla_dias_etapa`) — com badge de cor por faixa.
- Ativador (`agente_ativacao`).
- Perfil (`perfil_cliente`, normalizado P/M/G/GG).
- MRR (mantém para contexto).

**Filtros (multi-select, chips, igual ao padrão atual)**:
- SLA: faixas Crítico / Atenção / Alerta / Saudável (aplicado ao `sla_dias_etapa`).
- Fase: lista de `etapa_negocio` distintos.
- Ativador: lista de `agente_ativacao` distintos (para ativador não-admin, pré-fixado nele mesmo).
- Perfil: P / M / G / GG.

**Extras**:
- Busca por nome do negócio.
- Ordenação por qualquer coluna.
- Paginação client-side (50/página) ou scroll virtualizado se passar de ~500 linhas.
- Botão "Exportar CSV" reaproveitando `ExportCsvButton`.

---

## Estrutura técnica

**Arquivos novos**
- `src/components/dashboard/MacroEstoque.tsx` — Linhas A + B.
- `src/components/dashboard/MacroMovimento.tsx` — Linha C (hoje/semana/mês/mês ant.).
- `src/components/dashboard/CarteiraPorAtivador.tsx` — Linha D.
- `src/components/dashboard/DealsTable.tsx` — Bloco 2 com filtros + tabela.

**Arquivos editados**
- `src/pages/Index.tsx` — reescrito: header + Bloco 1 + Bloco 2. Mantém `useDashOperacoes`, `useAtivadorScope`, `DealDrawer`, `EstoqueModal` (para drill do total).
- `src/hooks/useDashOperacoes.ts` — adicionar:
  - `slaP75Criacao`, `slaMedioCriacao` (sobre `sla_dias_criacao`).
  - `pctAcima30Criacao`, `pctAbaixo30Criacao`.
  - Manter os campos antigos para não quebrar referências em componentes não removidos.

**Arquivos removidos do `Index.tsx` (componentes ficam em disco)**
- `Highlights`, `BottleneckHeatmap`, `RankingTable`, `PerfilSlaPanel`, `RiskRanking`, `TrendChart`, `FunnelChart`, `AttentionPoints`, `SlaCritico`, `StalledTable`, `PeriodCompare`, `ManagerialView`, `AiInsightsCard`.
- A aba "Gestão" (admin) também sai — se quiser preservar, me avise antes de implementar.

---

## Pendência: desconto de pausados (P75 / média)

Você pediu para o SLA de criação descontar o tempo em que o card morou em **Processo Pausado**. **Hoje isso não é possível** porque:

- A tabela `dash_operacoes` guarda só o snapshot atual (`sla_dias_criacao`, `sla_dias_etapa`, `etapa_negocio`).
- Não existe histórico de transições de etapa nem campo "dias acumulados em pausa".

**Para implementar de verdade** seria necessário um destes caminhos (escolher depois):

1. **Sincronizar do HubSpot** o histórico da propriedade `dealstage` (eventos de mudança de etapa) para uma nova tabela `dash_operacoes_historico (id_deal, etapa, entrou_em, saiu_em)`. Aí calculamos `dias_em_pausa` por deal e fazemos `sla_ajustado = sla_dias_criacao - dias_em_pausa`.
2. **Adicionar uma coluna `dias_pausado`** na própria `dash_operacoes`, alimentada pelo n8n a partir do HubSpot (mais simples, sem nova tabela).

Nesta entrega vou usar `sla_dias_criacao` cru e deixar uma nota visível no card de SLA ("não desconta tempo em pausa — pendente histórico"). Quando você decidir o caminho 1 ou 2, faço a segunda etapa.

---

## Resumo do que muda visualmente

```text
ANTES (/)                          DEPOIS (/)
─────────────────                  ─────────────────
Header + filtros                   Header + filtros
SlaKpiRow                          ── Bloco 1: Macros ──
Highlights (4 cards)                 Estoque total + P/M/G/GG
PeriodGrids                          P75 + Média + %>30 + %≤30
Funnel + Operadores                  Novos hoje
Heatmap + Ranking                    MRR ativado H/S/M/M-1
PerfilSlaPanel                       Carteira por ativador
RiskRanking + Trend                ── Bloco 2: Lista ──
AttentionPoints + SlaCritico         Filtros (SLA/Fase/Ativador/Perfil)
ManagerialView (aba admin)           Tabela linha-a-linha + export
AiInsightsCard
```
