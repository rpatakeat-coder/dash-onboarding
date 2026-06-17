-- RLS de leitura para dash_upsell (espelha dash_sucesso): admin + viewer.
-- Idempotente: pode rodar mais de uma vez sem erro.

ALTER TABLE public.dash_upsell ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read dash_upsell" ON public.dash_upsell;
CREATE POLICY "Admins read dash_upsell"
  ON public.dash_upsell FOR SELECT TO authenticated
  USING (public.has_operations_role(auth.uid(), 'admin'::public.operations_role));

DROP POLICY IF EXISTS "Viewers read dash_upsell" ON public.dash_upsell;
CREATE POLICY "Viewers read dash_upsell"
  ON public.dash_upsell FOR SELECT TO authenticated
  USING (public.has_operations_role(auth.uid(), 'viewer'::public.operations_role));
