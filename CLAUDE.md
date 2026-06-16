# CLAUDE.md

Guia para o Claude Code trabalhar neste repositório. Mantenha conciso e atualizado.

## O que é

Dashboard interno da Takeat (origem Lovable) para os times de **Onboarding/Ativação** e **Sucesso/Retenção**. SPA em **Vite + React + TypeScript + shadcn/ui (Radix + Tailwind)**, dados no **Supabase** (Postgres + Auth + Edge Functions), deploy na Vercel.

## Comandos

```bash
npm install        # dependências (node_modules NÃO vem versionado)
npm run dev        # servidor de dev (Vite)
npm run build      # build de produção
npm run lint       # ESLint
npm run test       # Vitest (testes em src/test)
```

Não há `tsc` standalone configurado como script — o type-check acontece no `build`. Rode `npm run build` para validar tipos.

## Ambiente da máquina (importante)

- **Windows + PowerShell** (há também Bash/Git Bash). Caminhos com `C:\...`.
- **`node_modules` normalmente não está instalado** neste checkout — não dá para rodar build/lint/tsc sem `npm install` antes. Mudanças costumam ser validadas no Lovable.
- **`.env`** contém chaves do Supabase (URL, project id, publishable/anon key — são públicas/client-side). Está no `.gitignore`, mas **continua versionado no histórico do repo** (commitado antes). Não apague sem combinar.

## Git

- Remoto: `github.com/rpatakeat-coder/dash-onboarding` (branch `main`). Identidade local: `rpatakeat-coder <rpa.takeat@gmail.com>`.
- Push é via **HTTPS com PAT** (não há `gh` CLI). Use o token só no comando do push, sem gravar no `.git/config`; redija o token nos logs.
- Mensagens de commit em **pt-BR**.

## Arquitetura

- **Rotas**: `src/App.tsx`. Onboarding em `/`, `/minha-carteira`, `/admin`, `/tv`. Sucesso em `/sucesso*` (protegido por `AdminOnlyRoute`).
- **Áreas (Onboarding ↔ Sucesso)**: `src/contexts/AreaContext.tsx` + `src/components/AreaSwitcher.tsx`. A **URL é a fonte da verdade** — `areaFromPath(pathname)` deriva a área; `AreaProvider` fica **dentro** do `BrowserRouter` (precisa de `useLocation`). Preferência persiste em `localStorage["takeat:appArea"]`.
- **Dados**:
  - `src/hooks/useDashOperacoes.ts` → tabela `dash_operacoes` (Onboarding).
  - `src/hooks/useDashSucesso.ts` → tabela `dash_sucesso` (Sucesso). Pagina em lotes de 1000.
  - `src/integrations/supabase/` → client e `types.ts` (tipos gerados; fonte da verdade dos schemas).
  - **RLS**: tabelas `dash_*` exigem papel `admin` ou `viewer`. O acesso anônimo (anon key) é bloqueado — não dá para ler dados via REST anônimo nem listar nomes de etapas direto do banco.
- **Configurações editáveis**: tabela `app_settings` (chave/valor JSON). Ex.: `key = "metas"` (metas operacionais do Admin), `key = "copilot.system_prompt"`.
- **Filtros persistidos**: `src/hooks/usePersistedSet.ts` — `Set<string>` no localStorage; **conjunto vazio remove a chave** (não distingue "vazio" de "nunca escolheu").

## Convenções

- UI em **pt-BR**. Formatação: `fmtBRL`, `fmtPct` em `useDashSucesso.ts`.
- Cores via tokens do Tailwind (`text-primary`, `bg-card`, `text-muted-foreground`...), não hex cru.
- Componentes shadcn em `src/components/ui/` (não editar à toa). Blocos de tela em `src/components/dashboard/` (Onboarding) e `src/components/sucesso/` (Sucesso).
- Ações sensíveis no Admin passam por `logAudit` (`src/lib/audit.ts`).

## Gotchas do Dashboard de Sucesso (`src/pages/sucesso/Dashboard.tsx`)

- **KPIs do topo** (Total de Clientes, MRR, Segmentação P+M/G+GG) são **calculados no cliente** via `selectOverview(applySucessoFilter(...), { excludeChurn: false })`, respeitando os filtros. (Antes vinham da view `vw_sucesso_overview`, que **ignora filtros** — não volte a usá-la para os cards sem necessidade.)
- **Default "base ativa"**: o filtro "Ocultar fase" inicia com **Estorno e Churn** ocultos. Casamento robusto por `isEtapaOcultaPadrao` (`includes("estorno"|"churn")` normalizado — a grafia exata vem do banco e não é legível por aqui). Aplicado **uma vez por versão** via `localStorage["sucesso:etapas:defaultVersion"]`; bumpar a versão reaplica para todos.
- **Bloco de Churn** (`src/components/sucesso/ChurnSucesso.tsx`) ANALISA churn, então recebe `churnRows` próprios (sem o recorte "Ocultar fase"), senão ficaria vazio.
- **Definição do KPI de Churn**: deal com `etapa_negocio == "Churn"` **e** `etapa_de_cancelamento == "Sucesso"`, filtrado por `data_fechamento` no mês/ano selecionado, **dedupando por `id_deal`**.

> Notas mais detalhadas de sessão ficam na memória do projeto (`memory/`), fora do repo.
