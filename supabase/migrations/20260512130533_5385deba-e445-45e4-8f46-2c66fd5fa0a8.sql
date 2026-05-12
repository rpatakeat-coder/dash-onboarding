CREATE OR REPLACE FUNCTION public.list_operators()
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  avatar_url text,
  role public.operations_role,
  agente_ativacao text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_operations_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    uro.user_id,
    u.email::text,
    p.full_name,
    p.avatar_url,
    uro.role,
    uro.agente_ativacao,
    uro.created_at
  FROM public.user_roles_operations uro
  LEFT JOIN public.profiles p ON p.id = uro.user_id
  LEFT JOIN auth.users u ON u.id = uro.user_id
  ORDER BY uro.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_operators() FROM anon;

CREATE OR REPLACE FUNCTION public.distinct_agentes_ativacao()
RETURNS TABLE(agente text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT trim(agente_ativacao) AS agente
  FROM public.dash_operacoes
  WHERE agente_ativacao IS NOT NULL
    AND trim(agente_ativacao) <> ''
  ORDER BY 1;
$$;

REVOKE EXECUTE ON FUNCTION public.distinct_agentes_ativacao() FROM anon;