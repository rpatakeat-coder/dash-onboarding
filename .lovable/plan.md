# Evolução do Dashboard de Operações

5 entregas, podem ser feitas em sequência ou em paralelo. Sugiro nessa ordem porque os filtros globais alimentam todas as outras.

---

## 1. Filtros globais (período, ativador, perfil)

Barra fixa no topo do dashboard, sincronizada com a URL (compartilhável e sobrevive a reload).

- **Período**: presets (Hoje, 7d, 30d, 90d, Tudo) + range customizado via date picker.
- **Ativador**: multi-select com lista populada de `dash_operacoes.agente_ativacao`.
- **Perfil**: chips P / M / G / GG (multi).
- **Etapa**: multi-select de etapas do funil.
- Botão "Limpar filtros" + contador de deals filtrados ao lado.

**Como afeta tudo**: criar um `useDashFilters()` hook (Context) que devolve `{ filteredDeals, filters, setFilters }`. Todos os widgets passam a consumir `filteredDeals` em vez de fazer `select` próprio. Reduz queries e garante consistência.

---

## 2. Drill-down de cliente

Clicar em qualquer linha do `RiskRanking` (e de outros widgets onde fizer sentido) abre um **Sheet lateral** (não modal — fica mais leve pra navegar).

Conteúdo do painel:
- **Cabeçalho**: nome do deal, ativador, perfil, MRR, link HubSpot, badge de risco.
- **KPIs do deal**: SLA atual, dias na etapa, score de risco, posição no ranking.
- **Timeline de etapas**: parsing de `data_criacao` → `data_entrada_fase` → etapa atual.
- **Atividade**: últimas ligações (`Ligações Realizadas` por `id_deal`) e reuniões (`Reuniões Marcadas` por `id_deal`), ordenado desc.
- **Histórico de risco**: mini line chart com o score do deal nos últimos snapshots (precisa estender o snapshot — ver detalhes técnicos).
- **Ações sugeridas** (regras simples): "SLA > 60d em Pendências → escalar", "MRR alto + sem reunião nos últimos 14d → agendar QBR", etc.

---

## 3. Comparativo período a período

Cada KPI principal ganha um **delta** vs período anterior equivalente.

- Se filtro = "últimos 7d" → compara com 7d anteriores.
- Se filtro = "últimos 30d" → compara com 30d anteriores.
- Se filtro = "Tudo" → compara com snapshot de 30d atrás.

Visual: seta ↑/↓ + percentual + tooltip explicando a base de comparação. Cor verde/vermelho conforme se a métrica é "boa quando sobe" (% no prazo) ou "boa quando cai" (críticos, SLA médio).

Fonte de dados: `dash_operacoes_snapshots` (já temos snapshot diário rodando).

---

## 4. Export CSV / PDF

Botão no header do dashboard com dropdown:

- **Exportar CSV**: dump dos deals atualmente filtrados (todas as colunas relevantes). Geração client-side, sem edge function.
- **Exportar PDF**: snapshot visual do dashboard usando `html2canvas` + `jsPDF`. Inclui filtros aplicados no rodapé e timestamp. Útil pra anexar em ata de reunião.

---

## 5. Modo TV

Rota nova `/tv` (sem header, fundo escuro, fontes maiores).

- Auto-refresh dos dados a cada 60s.
- Carrossel: rotaciona a cada 20s entre 3 telas: (1) KPIs + heatmap, (2) Top 10 risco, (3) trend chart.
- Tecla `F` ou botão "Tela cheia" pra fullscreen real.
- Sem necessidade de login (usa anon — RLS já permite leitura).

---

## Detalhes técnicos

- **Filtros via URL**: usar `useSearchParams` do React Router. Estado canônico fica na URL, hook lê/escreve.
- **Consistência de dados**: hoje cada componente faz seu próprio `supabase.from('dash_operacoes')`. Refatorar pra um único `useDashOperacoes()` que carrega tudo uma vez (paginado) e cacheia via React Query. Os filtros são aplicados em memória — mais rápido e consistente.
- **Drill-down — histórico de risco do deal**: o snapshot atual só guarda agregados. Pra ter o score histórico por deal, duas opções:
  - (a) Adicionar tabela `deal_risk_history` (id_deal, snapshot_date, score, sla_dias, etapa) populada pela mesma edge function `snapshot-dash-operacoes`. Permite line chart real.
  - (b) Pular esse gráfico no drill-down v1 e adicionar depois.
  Sugiro **(a)** — custo baixo (mesma função, +1 insert) e desbloqueia o gráfico individual.
- **PDF**: `html2canvas` + `jspdf` (ambos npm, leves). Renderiza o `<main>` do dashboard.
- **Modo TV**: componente `<TvCarousel>` reutilizando os widgets existentes, com wrapper de fonte maior e auto-rotate via `setInterval`.
- **Performance**: com filtros em memória + React Query, só fazemos 1-2 queries por sessão em vez de 6+.

---

## Ordem sugerida de execução

```text
1. Filtros globais  ──┐
                       ├──▶  3. Comparativo período
2. useDashOperacoes() ─┘                            
                                                    
4. Drill-down (depende de 1 + nova tabela history)  
5. Export CSV/PDF (depende de 1)                    
6. Modo TV (depende de 1)                           
```

Posso começar por **1 + 2 (refactor base)** que destrava o resto, ou ir direto no drill-down se preferir ver valor de cliente primeiro. Me diz qual prefere.
