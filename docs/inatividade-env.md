# Sucesso → Inatividade (Monitor de Inatividade · CS)

Página portada do projeto `takeat-churn-tracker` para dentro do dash-operations.
Ranqueia restaurantes por risco de inatividade/churn e mostra a fila de retenção do CS.

- **Rota:** `/sucesso/inatividade` (protegida por `AdminOnlyRoute` — só Admin/Super Admin).
- **Front:** `src/features/inatividade/` (componentes + lib) e `src/pages/sucesso/Inatividade.tsx`.
- **Backend:** funções serverless em `api/` (`/api/restaurants`, `/api/cron/refresh`) que consomem
  o relatório `inactive-risk` da API da Takeat + HubSpot, com cache KV diário.
- **Auth:** o SPA manda o access token do Supabase como `Authorization: Bearer`; o servidor valida
  em `api/_lib/supabaseAuth.ts`. O gate de admin é no client (`AdminOnlyRoute`).

## Variáveis de ambiente (configurar na Vercel)

Marcar também o ambiente **Preview** para a branch funcionar no deploy de preview.
Sem essas chaves a página carrega mas mostra "dados indisponíveis".

| Variável | O que é |
| --- | --- |
| `INACTIVE_RISK_HOST` | Host da API Takeat que serve o `inactive-risk` (ex.: `https://api.takeat.app`). |
| `SERVICE_ADMIN_EMAIL` / `SERVICE_ADMIN_PASSWORD` | Conta admin de serviço usada server-side para chamar o endpoint. Nunca vai ao browser. |
| `HUBSPOT_PRIVATE_APP_TOKEN` | HubSpot Private App (read em deals + owners) para resolver o responsável de CS. |
| `HUBSPOT_DEAL_USERNAME_PROPERTY` | (opcional) Propriedade do deal com o username Takeat. Default: `username`. |
| `HUBSPOT_CS_OWNER_PROPERTY` | (opcional) Propriedade do deal com o agente de CS. Default: `agente_do_sucesso_responsavel`. |
| `SUPABASE_URL` | URL do projeto Supabase (mesmo do front) — usado pela ponte de auth do servidor. |
| `SUPABASE_ANON_KEY` | Anon/publishable key — usada pelo servidor para validar o token do usuário. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Cache diário (Vercel KV / Upstash). Injetadas ao conectar o store. Sem elas, refaz o build a cada cold start. |
| `CRON_SECRET` | Injetada automaticamente pela Vercel; protege o `/api/cron/refresh` noturno (só roda em produção). |

> Auth por senha-app do churn-tracker foi removida — não precisa de `APP_PASSWORD` nem `SESSION_SECRET`.

## Notas do port

- React 19 → 18 e recharts 3 → 2: APIs usadas são compatíveis.
- Paleta visual própria do churn-tracker preservada via tokens `brand/surface/ink/...` no
  `tailwind.config.ts` (sem colidir com os tokens shadcn; `cmuted/cmuted2` no lugar do `muted`).
- Os testes (Vitest) do churn-tracker **não** foram portados nesta primeira leva.
