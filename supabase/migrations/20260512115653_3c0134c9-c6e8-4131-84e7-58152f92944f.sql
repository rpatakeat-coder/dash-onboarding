ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agente_ativacao text;

CREATE INDEX IF NOT EXISTS idx_profiles_agente_ativacao_lower
  ON public.profiles (lower(agente_ativacao));

-- Allow admins to update the agente_ativacao mapping on any profile
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));