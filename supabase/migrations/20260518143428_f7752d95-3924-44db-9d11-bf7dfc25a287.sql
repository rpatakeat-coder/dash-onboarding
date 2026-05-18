CREATE OR REPLACE FUNCTION public.has_operations_role(_user_id uuid, _role operations_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles_operations
    WHERE user_id = _user_id
      AND (
        role = _role
        OR (_role = 'admin'::operations_role AND role = 'super_admin'::operations_role)
      )
  )
$function$;