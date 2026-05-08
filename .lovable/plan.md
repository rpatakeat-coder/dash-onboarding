## Objetivo

Adicionar três frentes de produtividade ao painel: central de **notificações & alertas**, **tema claro/escuro com preferências** e **busca global (Cmd+K)** para navegação rápida.

---

## 1. Notificações & alertas

**O que o usuário vê**
- Sino no header (ao lado do nome) com badge de contagem não-lidas.
- Popover lista alertas agrupados por tipo (SLA crítico, deal parado, meta atingida) com link direto pro deal/operador.
- Toast (sonner) ao surgir um alerta novo na sessão.
- Cada item: marcar como lido, "marcar todos como lidos", limpar histórico.

**Regras automáticas (derivadas dos dados já carregados em `useDashOperacoes`)**
- SLA crítico: deals onde `dias_em_etapa` excede a meta da etapa.
- Deal parado: sem movimentação há > 7 dias.
- Meta semanal: operador atinge / supera meta.
- Recompute a cada refresh do hook; deduplica por `dealId+tipo`.

**Persistência**
- Lidas/dispensadas em `localStorage` por usuário (`notif:read:<userId>`); sem backend nesta etapa.

---

## 2. Tema claro/escuro + preferências

**O que o usuário vê**
- Botão sol/lua no header (claro / escuro / sistema).
- Painel "Preferências" (modal acionado por ícone de engrenagem) com:
  - Tema (claro / escuro / auto)
  - Densidade (confortável / compacta) — afeta paddings dos KPIs/tabelas
  - Página inicial padrão (Visão geral / Minha carteira / Modo TV)
  - Toggle de notificações por tipo

**Implementação**
- Provider `ThemeProvider` em `src/contexts/` salvando em `localStorage` (`prefs:v1`).
- Tokens dark já existem em `src/index.css` (`.dark` block) — apenas validar contraste; ajustar onde necessário.
- Densidade aplicada via classe `data-density="compact"` no `<html>` + utilities Tailwind condicionais nos componentes-chave (KpiCard, tabelas).

---

## 3. Busca global Cmd+K

**O que o usuário vê**
- Atalho `Cmd/Ctrl+K` (e botão discreto no header com hint do atalho) abre paleta.
- Pesquisa em tempo real:
  - **Páginas**: Visão geral, Minha carteira, Modo TV, Auth.
  - **Operadores**: filtra ranking; ao escolher, abre modal `OperatorCarteiraModal`.
  - **Deals**: por nome do restaurante; ao escolher, abre `DealDrawer`.
  - **Ações rápidas**: aplicar período (Hoje, 7d, 30d), alternar tema, exportar CSV/PDF, abrir preferências.
- Navegação por teclado (setas, enter, esc).

**Implementação**
- Componente `CommandPalette` usando `cmdk` (já presente em shadcn `command.tsx`).
- Provider montado no `App.tsx` para estar disponível em todas as rotas.
- Listener global de teclado em `useEffect`.

---

## Arquivos novos

```text
src/contexts/PreferencesContext.tsx     // tema + densidade + página inicial + toggles
src/contexts/NotificationsContext.tsx   // gera, persiste e expõe alertas
src/components/CommandPalette.tsx       // Cmd+K
src/components/NotificationsBell.tsx    // sino + popover
src/components/PreferencesDialog.tsx    // modal de preferências
src/components/ThemeToggle.tsx          // botão sol/lua
src/lib/notifications.ts                // regras: gerarAlertas(dadosDash)
```

## Arquivos editados

```text
src/App.tsx                             // envolve com PreferencesProvider + NotificationsProvider + CommandPalette
src/components/dashboard/DashboardHeader.tsx  // adiciona sino, theme toggle, botão Cmd+K, ícone preferências
src/index.css                           // ajustes finos de contraste no .dark e variáveis de densidade
src/hooks/useDashOperacoes.ts           // expõe dados para feed de notificações (sem mudar lógica)
```

## Detalhes técnicos

- **Sem novas tabelas/edge functions** nesta etapa — tudo client-side com `localStorage`.
- **cmdk** já está instalado via shadcn (`src/components/ui/command.tsx`).
- **sonner** já configurado para toasts.
- Atalhos: `Cmd/Ctrl+K` (busca), `Cmd/Ctrl+,` (preferências), `Cmd/Ctrl+Shift+L` (alternar tema).
- Acessibilidade: foco visível, `aria-live="polite"` no badge do sino, todos os menus/dialogs do Radix.
- Performance: alertas memoizados; paleta usa virtualização do `cmdk` nativamente.

## Fora de escopo (sugestões para próximas iterações)

- Push notifications nativas (precisa Lovable Cloud + service worker — incompatível com a configuração manifest-only atual).
- Sincronização de preferências entre dispositivos (exigiria tabela `user_preferences`).
- Busca dentro de relatórios históricos.
