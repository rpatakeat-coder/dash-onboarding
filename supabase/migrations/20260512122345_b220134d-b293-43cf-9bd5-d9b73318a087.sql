INSERT INTO public.user_roles_operations (user_id, role)
VALUES ('85d8d28d-5c65-43c7-829d-94f54e0b2bf2', 'admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';