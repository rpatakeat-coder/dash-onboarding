# Novo papel: `viewer`

Cria um papel adicional em `operations_role` para usuários que só visualizam os rankings de meta (RankingMetasMedalhas e RankingVariavelAtivadores). Sem acesso a admin, sem carteira, sem demais blocos da dashboard. Vê dados de todos os ativadores (somente leitura).

## 1. Banco

Migração:

- Adicionar valor `'viewer'` ao enum `operations_role`.
- Atualizar a função `has_operations_role` para reconhecer `viewer` apenas como `viewer` (não herda admin).
- Política RLS extra em `dash_operacoes` permitindo SELECT global para `viewer`:
  ```sql
  CREATE POLICY "Viewers read all dash_operacoes"
  ON public.dash_operacoes FOR SELECT TO authenticated
  USING (has_operations_role(auth.uid(), 'viewer'));
  ```
- `agente_ativacao` em `user_roles_operations` continua opcional (não é exigido para viewer).
- Ajustar `admin-create-operator` para aceitar `role: 'viewer'` no schema Zod e dispensar `agente_ativacao` quando role for `admin` **ou** `viewer`.

## 2. Front-end

### Novo hook `useUserRole`
Retorna `{ role: 'super_admin' | 'admin' | 'viewer' | 'user', isAdmin, isViewer, loading }` consultando `user_roles_operations`. Substitui/estende `useIsAdmin` (mantém compat).

### `src/pages/Index.tsx`
Quando `isViewer === true`:
- Renderiza apenas `DashboardHeader` mínimo + `<RankingMetasMedalhas rows={allRows} />` + `<RankingVariavelAtivadores rows={allRows} />`.
- Esconde MacroEstoque, MacroMovimento, filtros, carteira, churn, gestão, AI, etc.

### Rotas (`src/App.tsx`)
Criar guard `ViewerLockRoute` (ou estender `ProtectedRoute`): quando o usuário é `viewer`, qualquer rota diferente de `/` redireciona para `/`. Bloqueia `/minha-carteira`, `/tv`, `/admin`, `/sucesso/*`.

### Navegação
- `MainNav` e `MobileMainNav`: ocultar todos os itens quando `isViewer` (mostrar só logo + logout).
- `AreaSwitcher`, `CopilotDrawer`, `PreferencesDialog`: desabilitar/ocultar entradas restritas para viewer.

### Admin UI
- `src/pages/Admin.tsx` (form de criar/editar operador): adicionar opção "Viewer" no select de role, ao lado de `user` e `admin`. Esconder o campo `agente_ativacao` quando role = `admin` ou `viewer`.

## 3. Validação

- Login com usuário `viewer`: Home mostra somente os dois rankings, navbar limpa, tentativa de acessar `/admin` redireciona para `/`.
- Consulta a `dash_operacoes` retorna todos os ativadores (RLS).
- Admin cria novo viewer pelo painel sem precisar informar agente.

## Detalhes técnicos

- O enum existente é `"admin" | "user" | "super_admin"`; adicionar `viewer` exige `ALTER TYPE operations_role ADD VALUE 'viewer'` em migração própria (não pode estar dentro de transação com uso do valor — usar migração isolada).
- `has_operations_role` hoje trata `super_admin` como admin; manter essa lógica e adicionar branch explícita para viewer (sem herança).
- `useAtivadorScope.isAtivador` continua `false` para viewer (não é admin, mas também não tem agente) — usar `isViewer` para diferenciar nos componentes.
