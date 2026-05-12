-- profiles
CREATE POLICY "Ops admins can read all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_operations_role(auth.uid(), 'admin'));

CREATE POLICY "Ops admins can update any profile"
ON public.profiles FOR UPDATE TO authenticated
USING (public.has_operations_role(auth.uid(), 'admin'))
WITH CHECK (public.has_operations_role(auth.uid(), 'admin'));

-- audit_logs
CREATE POLICY "Ops admins can read all audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (public.has_operations_role(auth.uid(), 'admin'));

-- app_settings
CREATE POLICY "Ops admins can insert app_settings"
ON public.app_settings FOR INSERT TO authenticated
WITH CHECK (public.has_operations_role(auth.uid(), 'admin'));

CREATE POLICY "Ops admins can update app_settings"
ON public.app_settings FOR UPDATE TO authenticated
USING (public.has_operations_role(auth.uid(), 'admin'))
WITH CHECK (public.has_operations_role(auth.uid(), 'admin'));

CREATE POLICY "Ops admins can delete app_settings"
ON public.app_settings FOR DELETE TO authenticated
USING (public.has_operations_role(auth.uid(), 'admin'));

-- user_roles (legacy)
CREATE POLICY "Ops admins can manage legacy user_roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_operations_role(auth.uid(), 'admin'))
WITH CHECK (public.has_operations_role(auth.uid(), 'admin'));