-- Time (equipe) por usuário: controla quais áreas o usuário enxerga no app.
-- Valores: onboarding / sucesso / gestor. NULL = usa o default por papel resolvido no frontend
-- (admin/super_admin -> gestor; demais -> onboarding).
-- O Time só restringe usuários viewer/comuns; admin/super_admin veem tudo. Não altera RLS.
DO $$ BEGIN
  CREATE TYPE public.app_team AS ENUM ('onboarding', 'sucesso', 'gestor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.user_roles_operations
  ADD COLUMN IF NOT EXISTS equipe public.app_team;
