-- Enum for operations role
DO $$ BEGIN
  CREATE TYPE public.operations_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE public.user_roles_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  role public.operations_role NOT NULL DEFAULT 'user',
  agente_ativacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_roles_operations_user_id ON public.user_roles_operations(user_id);
CREATE INDEX idx_user_roles_operations_agente_lower ON public.user_roles_operations(lower(agente_ativacao));

-- Updated_at trigger (reuse existing set_updated_at function)
CREATE TRIGGER trg_user_roles_operations_updated_at
BEFORE UPDATE ON public.user_roles_operations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Security definer helper to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.has_operations_role(_user_id uuid, _role public.operations_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles_operations
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Enable RLS
ALTER TABLE public.user_roles_operations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read own operations role"
ON public.user_roles_operations FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Ops admins can read all operations roles"
ON public.user_roles_operations FOR SELECT
TO authenticated
USING (public.has_operations_role(auth.uid(), 'admin'));

CREATE POLICY "Ops admins can insert operations roles"
ON public.user_roles_operations FOR INSERT
TO authenticated
WITH CHECK (public.has_operations_role(auth.uid(), 'admin'));

CREATE POLICY "Ops admins can update operations roles"
ON public.user_roles_operations FOR UPDATE
TO authenticated
USING (public.has_operations_role(auth.uid(), 'admin'))
WITH CHECK (public.has_operations_role(auth.uid(), 'admin'));

CREATE POLICY "Ops admins can delete operations roles"
ON public.user_roles_operations FOR DELETE
TO authenticated
USING (public.has_operations_role(auth.uid(), 'admin'));

-- Allow global admins (existing app_role) to also manage
CREATE POLICY "Global admins can manage operations roles"
ON public.user_roles_operations FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));