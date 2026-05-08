CREATE POLICY "Anon can read dash_operacoes for embed"
ON public."dash_operacoes"
FOR SELECT
TO anon
USING (true);