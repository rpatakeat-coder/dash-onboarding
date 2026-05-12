
-- Helper: returns the agente_ativacao bound to the current user
CREATE OR REPLACE FUNCTION public.current_user_agente()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(trim(uro.agente_ativacao), ''),
    NULLIF(trim(p.agente_ativacao), ''),
    NULLIF(trim(p.full_name), '')
  )
  FROM public.user_roles_operations uro
  FULL OUTER JOIN public.profiles p ON p.id = uro.user_id
  WHERE COALESCE(uro.user_id, p.id) = auth.uid()
  LIMIT 1;
$$;

-- Replace the permissive authenticated SELECT policy with a scoped one
DROP POLICY IF EXISTS "Authenticated users can read dash_operacoes" ON public."dash_operacoes";

CREATE POLICY "Admins read all dash_operacoes"
ON public."dash_operacoes"
FOR SELECT
TO authenticated
USING (public.has_operations_role(auth.uid(), 'admin'));

CREATE POLICY "Ativadores read own dash_operacoes"
ON public."dash_operacoes"
FOR SELECT
TO authenticated
USING (
  NOT public.has_operations_role(auth.uid(), 'admin')
  AND public.current_user_agente() IS NOT NULL
  AND lower(trim(agente_ativacao)) = lower(public.current_user_agente())
);
