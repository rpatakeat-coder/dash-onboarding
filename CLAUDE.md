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
- **Todo commit é sempre feito como `rpatakeat-coder <rpa.takeat@gmail.com>`** (autor e committer). É a conta conectada à Vercel; commitar com outro autor quebra o deploy. Não troque a identidade nem use `--author`.
- Push é via **HTTPS com PAT** (não há `gh` CLI). Use o token só no comando do push, sem gravar no `.git/config`; redija o token nos logs.
- Mensagens de commit em **pt-BR**.
- **NÃO** adicione o trailer `Co-Authored-By:` — a Vercel (Hobby + repo privado) bloqueia o deploy de commits com co-autor que não é membro do projeto. A conta conectada à Vercel é a `rpatakeat-coder` (autor ok); o co-autor externo é que quebra.

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
- **Default "base ativa"**: o filtro "Ocultar fase" inicia com **Estorno e Churn** ocultos. Casamento robusto por `isEtapaOcultaPadrao` (`includes("estorno"|"churn")` normalizado — a grafia exata vem do banco e não é legível por aqui). Mecanismo: o conjunto EFETIVO `ocultarEtapas` = default (derivado dos dados) enquanto `localStorage["sucesso:etapas:custom"]` não existir; ao interagir com o filtro, passa a valer a seleção do usuário (`filtroEtapas`). Esse modelo nunca "trava" (recalcula o default sempre), ao contrário do flag de versão antigo. `rows`/`carteira`/`ov` são filtrados no componente via `applySucessoFilter(rowsRaw, …)`, não pelo `useDashSucesso(filter)`.
- **Bloco de Churn** (`src/components/sucesso/ChurnSucesso.tsx`) ANALISA churn, então recebe `churnRows` próprios (sem o recorte "Ocultar fase"), senão ficaria vazio.
- **Definição do KPI de Churn** (`ChurnSucesso.tsx`): `etapa_negocio == "Churn"` **e** `etapa_de_cancelamento == "Sucesso"`, filtrado por `data_fechamento` no mês/ano selecionado. É `COUNT(*)` (sem dedup).
- **Aba Churn** (`/sucesso/churn`, `pages/sucesso/Churn.tsx`): sub-abas Visão Geral / Meu Desempenho / Motivos / MRR, com seletor de mês/ano. Visão Geral, MRR e Meu Desempenho usam a regra "Só Sucesso" (etapa Churn + etapa_de_cancelamento='Sucesso'); **Motivos** agrupa TODO o churn do período por `etapa_de_cancelamento`. "Meu Desempenho" filtra por `agente_sucesso` == nome do usuário logado (`agenteAtivacao`/`fullName`). O bloco de churn do Dashboard foi mantido (existe nos dois).
- **⚠️ Formato de data**: em `dash_sucesso`, `data_fechamento` (e provavelmente `data_entrada_fase`) é **string BR `DD/MM/YYYY HH:MM:SS`**, NÃO ISO. `new Date(...)` retorna Invalid Date — sempre case por string (`includes("/MM/YYYY")`) ou parseie manualmente. Isso afeta também o filtro de período global (`applySucessoFilter` usa `new Date`), que quebra com período ≠ "Tudo"; o bloco de Churn usa seu próprio seletor de mês/ano.

> Notas mais detalhadas de sessão ficam na memória do projeto (`memory/`), fora do repo.
