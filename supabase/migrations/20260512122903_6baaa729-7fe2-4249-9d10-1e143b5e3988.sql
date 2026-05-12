-- Drop policies that reference legacy has_role / user_roles
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can insert app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can update app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can delete app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Global admins can manage operations roles" ON public.user_roles_operations;
DROP POLICY IF EXISTS "Ops admins can manage legacy user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;

-- Drop legacy functions and table
DROP FUNCTION IF EXISTS public.list_admin_users();
DROP FUNCTION IF EXISTS public.claim_first_admin();
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP TABLE IF EXISTS public.user_roles;
DROP TYPE IF EXISTS public.app_role;

-- Recreate claim_first_admin against the new table
CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_has_admin boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.user_roles_operations WHERE role = 'admin') INTO v_has_admin;
  IF v_has_admin THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_roles_operations (user_id, role)
  VALUES (v_uid, 'admin')
  ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM anon;