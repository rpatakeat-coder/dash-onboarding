DROP FUNCTION IF EXISTS public.list_operators();

CREATE OR REPLACE FUNCTION public.list_operators()
 RETURNS TABLE(
   user_id uuid,
   email text,
   full_name text,
   avatar_url text,
   role operations_role,
   agente_ativacao text,
   created_at timestamp with time zone,
   last_sign_in_at timestamp with time zone,
   email_confirmed_at timestamp with time zone,
   invited_at timestamp with time zone,
   has_password boolean
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    uro.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    u.invited_at,
    (u.encrypted_password IS NOT NULL) AS has_password
  FROM public.user_roles_operations uro
  LEFT JOIN public.profiles p ON p.id = uro.user_id
  LEFT JOIN auth.users u ON u.id = uro.user_id
  ORDER BY uro.created_at DESC;
END;
$function$;