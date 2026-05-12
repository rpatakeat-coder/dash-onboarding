
# Painel "Insights da IA"

Provedor: **OpenAI** (modelo padrão `gpt-4o-mini`, configurável). Sua API Key fica como secret no Supabase — nunca vai pro frontend. Disparo **manual** via botão "Gerar análise", com cache de 10 min por sessão.

## Entregas

1. **Card "Insights da IA"** no topo do dashboard (`Index.tsx`) com:
   - Botão **"Gerar análise"** + estado de loading.
   - **Resumo executivo do dia** (3–5 bullets em markdown).
   - **Sugestões de ação por operador** (top 5 com mais críticos), cada uma com nome do operador + ação recomendada.
   - Timestamp da última geração + botão "Atualizar".

2. **Botão "Explicar este KPI"** em cada `KpiCard` → abre modal com explicação contextual (compara valor atual com snapshot anterior, contextualiza variação).

3. **Edge function `ai-insights`** (Supabase) que:
   - Recebe `{ mode: "dashboard" | "kpi", payload }`.
   - Monta prompt com os dados (KPIs, operadores, snapshot anterior).
   - Chama OpenAI com sua chave (`OPENAI_API_KEY` secret).
   - Devolve markdown estruturado.
   - Trata erros 401/429/quota explicitamente.

4. **Secrets**: `OPENAI_API_KEY` (sua chave) + opcional `OPENAI_MODEL` (default `gpt-4o-mini`).

## Arquitetura

```text
[KpiCard / Index.tsx] ──click──▶ [useAiInsights hook]
                                        │
                                        ▼
                          supabase.functions.invoke('ai-insights')
                                        │
                                        ▼
                    [Edge Function ai-insights/index.ts]
                          │ valida JWT + monta prompt
                          ▼
                    api.openai.com/v1/chat/completions
                          │
                          ▼
                    devolve { content, usage, model }
```

## Detalhes técnicos

**Edge function** (`supabase/functions/ai-insights/index.ts`):
- Valida JWT do usuário autenticado.
- Aceita 2 modos:
  - `mode: "dashboard"` → recebe `{ kpis, operadores, snapshotAnterior, periodo }` e retorna resumo + sugestões.
  - `mode: "kpi"` → recebe `{ kpiName, valorAtual, valorAnterior, contexto }` e retorna explicação curta (2–3 frases).
- Sistema de prompt em PT-BR, tom executivo, sem inventar números.
- `temperature: 0.2`, `max_tokens: 600` (dashboard) / `200` (kpi).
- Trata 429 → "Limite atingido, tente em alguns minutos"; 402/insufficient_quota → "Créditos OpenAI esgotados".
- CORS habilitado, `verify_jwt = true` (no `config.toml`).

**Hook `useAiInsights`** (`src/hooks/useAiInsights.ts`):
- Cache em `sessionStorage` por chave (`dashboard:<hashFiltros>` / `kpi:<nome>:<valor>`), TTL 10 min.
- Retorna `{ data, isLoading, error, generate, lastGeneratedAt }`.
- Não dispara automático — só quando o usuário clica.

**Componente `AiInsightsCard`** (`src/components/dashboard/AiInsightsCard.tsx`):
- Header com ícone Sparkles, título "Insights da IA", badge "OpenAI".
- Estado vazio: CTA "Gerar análise" com explicação curta.
- Estado loading: skeleton + "Analisando dados…".
- Estado pronto: 2 seções (Resumo / Ações por operador) renderizadas com `react-markdown` (instalar).
- Footer: "Gerado há X min · Modelo: gpt-4o-mini" + botão refresh.
- Erros mostrados em alerta inline com mensagem amigável.

**Modal `ExplainKpiDialog`** (`src/components/dashboard/ExplainKpiDialog.tsx`):
- Trigger: ícone discreto (Sparkles) no canto do `KpiCard`.
- Mostra: nome do KPI, valor atual, delta vs período anterior, explicação da IA.

**Integrações**:
- `KpiCard.tsx`: nova prop opcional `onExplain?: () => void` + botão sparkles no canto.
- `Index.tsx`: renderizar `<AiInsightsCard />` logo após o header de filtros.
- Estado do modal de explicação centralizado em `Index.tsx` (passa `onExplain` para cada KpiCard).

**Dependência nova**: `react-markdown` (~30kb).

## Segurança

- `OPENAI_API_KEY` **só** no Supabase secrets, nunca no client.
- Edge function valida JWT → só usuários logados podem gerar.
- Rate limit simples in-memory: máx 10 req/min por user_id (proteção contra abuso).
- Logs de uso na tabela `audit_logs` existente (`action: "ai_insights_generated"`, `metadata: { mode, model, tokens }`) — opcional mas recomendado.

## Fluxo de implementação

1. Pedir o secret `OPENAI_API_KEY` (e opcional `OPENAI_MODEL`).
2. Criar edge function `ai-insights` com os 2 modos.
3. Criar hook `useAiInsights` com cache.
4. Criar `AiInsightsCard` e plugar no `Index.tsx`.
5. Criar `ExplainKpiDialog` e adicionar trigger no `KpiCard`.
6. Instalar `react-markdown`.
7. Testar: gerar análise, explicar KPI, simular erro de quota.

## O que NÃO está incluído (fica para depois)

- Streaming de resposta (vai chegar de uma vez).
- Histórico persistente das análises geradas (só cache de sessão).
- Geração automática agendada.
- Análise por operador individual em modal próprio (só lista no card).
