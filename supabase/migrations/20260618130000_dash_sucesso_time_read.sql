-- Libera leitura de dash_sucesso para quem tem Time (equipe) = sucesso ou gestor.
-- Modelo: o Time define o papel — Onboarding/Sucesso são papel 'user'; Sucesso precisa ver
-- os dados de Sucesso. Aditivo às policies existentes (admin/viewer).

-- Helper SECURITY DEFINER (espelha current_user_agente) para ler a equipe do usuário atual
-- sem esbarrar no RLS da própria user_roles_operations.
CREATE OR REPLACE FUNCTION public.current_user_equipe()
RETURNS public.app_team
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT equipe FROM public.user_roles_operations WHERE user_id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.current_user_equipe() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.current_user_equipe() TO authenticated;

CREATE POLICY "Time Sucesso le dash_sucesso"
  ON public.dash_sucesso FOR SELECT TO authenticated
  USING (public.current_user_equipe() IN ('sucesso', 'gestor'));
