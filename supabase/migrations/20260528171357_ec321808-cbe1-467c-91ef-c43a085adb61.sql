CREATE POLICY "Viewers read all dash_operacoes"
ON public.dash_operacoes
FOR SELECT
TO authenticated
USING (public.has_operations_role(auth.uid(), 'viewer'::public.operations_role));