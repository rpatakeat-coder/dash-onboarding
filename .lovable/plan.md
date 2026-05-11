# Roadmap de evolução do Painel

Selecionado: IA com **sua própria API** (não Lovable AI), previsão de churn/atraso, metas e gamificação, comparativo histórico avançado, auditoria/versionamento, painel admin com roles, integrações, onboarding guiado, busca e filtros salvos.

Organizado em **5 fases independentes**. Cada fase entrega valor sozinha.

---

## Fase A — Inteligência no dashboard (sua API de IA)

Foco: insights automáticos usando uma API externa que você já tem (ex.: OpenAI, Anthropic, Groq, Azure OpenAI, sua própria).

- **Edge Function `ai-insights`** no Supabase recebe `{ rows, operadores, periodo }` e devolve:
  - Resumo executivo do dia (3–5 bullets).
  - Explicação automática de variações fortes de KPI (vs. snapshot anterior).
  - Sugestão de ação por operador com mais críticos.
- Chave guardada como **secret** (`AI_PROVIDER_API_KEY` + `AI_PROVIDER_BASE_URL` + `AI_MODEL`). Nada vaza pro frontend.
- Card "Insights da IA" no topo do dashboard com botão **Gerar análise** + estado de loading + cache de 10 min por sessão.
- Botão "Explicar este KPI" em cada `KpiCard` → modal com explicação contextual.

**Antes de começar preciso saber:** qual provedor (OpenAI / Anthropic / outro) e o `base URL` + nome do modelo.

**Toca em:** `supabase/functions/ai-insights/index.ts` (novo), `src/components/dashboard/AiInsightsCard.tsx` (novo), `KpiCard.tsx` (botão explicar), `Index.tsx`.

---

## Fase B — Análise avançada

### B1 · Previsão de churn/atraso de SLA
- Heurística inicial 100% client-side: combina dias parado, etapa, perfil, histórico do operador → score 0–100.
- Coluna "Risco previsto" no `RiskRanking` + filtro "Top 20 em risco".
- Opção de **upgrade**: enviar batch para sua API de IA classificar (mesma edge function).

### B2 · Metas e gamificação
- Nova tabela `metas_operador` (operador, mes_referencia, meta_ativacoes, meta_sla_medio, meta_mrr_destravado).
- Barra de progresso por operador no `OperatorsTable`.
- **Ranking semanal** com pódio + badges ("Zero crítico 7d", "Maior MRR destravado", "Streak de 5 dias").
- Notificação quando bater meta.

### B3 · Comparativo histórico avançado
- Heatmap cohort: mês de entrada × dias até ativação.
- Waterfall MRR: entrou → ativou → travou → destravou → perdeu.
- Sparkline em cada KPI mostrando últimos 30 dias (usa `dash_operacoes_snapshots`).

### B4 · Auditoria e versionamento
- Nova tabela `dash_operacoes_audit` (id_deal, campo, valor_anterior, valor_novo, changed_at).
- Trigger SQL captura mudanças de `etapa_negocio`, `agente_ativacao`, `sla_dias`.
- Tela "Histórico do deal" no `DealDrawer` com timeline.
- Diff entre datas: "o que mudou entre 01/05 e 11/05?".

**Toca em:** migrações SQL (3 tabelas + trigger), `src/lib/risk.ts`, `RiskRanking.tsx`, `OperatorsTable.tsx`, `DealDrawer.tsx`, novos componentes `MetaProgress`, `CohortHeatmap`, `MrrWaterfall`, `DealAuditTimeline`.

---

## Fase C — Painel admin com roles

- Já existe `user_roles` + `has_role`. Falta a UI.
- Nova rota `/admin` protegida por `has_role(uid,'admin')`.
- Telas:
  - **Usuários**: lista de `profiles`, botão promover/remover admin, último login.
  - **Operadores**: CRUD de `vendedores` (já existe a tabela), upload de avatar.
  - **Metas**: editor das metas mensais (Fase B2).
  - **Configurações**: limites de SLA por banda, perfis críticos, modelo de IA padrão.
- `MainNav` mostra item "Admin" só para admins.

**Toca em:** `src/pages/Admin.tsx` + subpáginas, `App.tsx` (rota), `MainNav.tsx`, hook `useIsAdmin`.

---

## Fase D — Integrações e onboarding

### D1 · Integrações
- **Webhook HubSpot → Supabase** (edge function `hubspot-webhook`) para atualizar `dash_operacoes` em tempo real, em vez de polling.
- **Export para Google Sheets**: edge function gera planilha e devolve link (via Google Sheets API com sua chave).
- **Envio automático do PDF por e-mail**: cron diário pega o PDF mais recente e envia para lista configurada (Resend ou seu SMTP).

### D2 · Busca e filtros salvos
- Nova tabela `saved_views` (user_id, nome, filtros jsonb, is_pinned, created_at).
- Botão "Salvar visão atual" ao lado dos filtros → captura URL params.
- Sidebar "Minhas visões" com pinned no topo.
- Cada visão tem URL compartilhável (`/?view=<id>`).

### D3 · Onboarding guiado
- Lib `driver.js` ou `react-joyride`.
- Tour de 6 passos no primeiro login: KPIs → Funil → Operadores → SLA → Filtros → Export PDF.
- Tooltips contextuais com `?` ao lado de termos (SLA, MRR destravado, Crítico).
- Central de ajuda em `/ajuda` com FAQ + glossário.
- Flag `onboarding_completed` em `profiles`.

**Toca em:** `supabase/functions/hubspot-webhook/`, `export-sheets/`, `email-pdf/`, migração `saved_views`, novos componentes `SavedViewsMenu`, `OnboardingTour`, `HelpCenter`.

---

## Fase E — Continuidade do Export PDF (do plano antigo)

Manter o que já estava planejado em `.lovable/plan.md`: Fase 2 (landscape + acessibilidade), Fase 3 (modal + histórico + share), Fase 4 (testes E2E + visual).

---

## Ordem sugerida

1. **Fase A** — IA com sua API (maior wow, baixo risco). Preciso só do provedor + modelo.
2. **Fase C** — Admin (destrava metas e configurações das outras fases).
3. **Fase B** — Análise avançada (B2 metas → B1 risco → B3 histórico → B4 auditoria).
4. **Fase D** — Integrações + filtros salvos + onboarding.
5. **Fase E** — Fechar o Export PDF.

---

## Detalhes técnicos importantes

- **Sua API de IA na edge function**:
  ```ts
  const r = await fetch(`${Deno.env.get('AI_PROVIDER_BASE_URL')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('AI_PROVIDER_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: Deno.env.get('AI_MODEL'), messages, temperature: 0.2 }),
  });
  ```
  Funciona com qualquer provedor compatível com a API da OpenAI (OpenAI, Groq, Together, Azure, vLLM próprio, OpenRouter, etc.). Se for Anthropic puro, ajusto o adapter.
- **Roles**: já está pronto, só consumir `has_role` via RPC ou via policy nas novas tabelas.
- **Auditoria**: trigger `AFTER UPDATE ON dash_operacoes` grava em `dash_operacoes_audit` quando colunas relevantes mudam.
- **Saved views**: filtros já vivem na URL (`useUrlSets`), então persistir é serializar `location.search`.
- **Onboarding**: `react-joyride` é leve e combina com Tailwind.

Qual fase você quer atacar primeiro? Se for a **Fase A**, me diga o provedor de IA e o modelo que vamos usar.
