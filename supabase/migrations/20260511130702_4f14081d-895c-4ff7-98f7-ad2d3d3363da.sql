-- Tabela genérica de configurações chave/valor para metas e ajustes do painel
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Todos autenticados podem ler (necessário para o app aplicar metas)
CREATE POLICY "Authenticated can read app_settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (true);

-- Somente admins podem criar/editar/remover
CREATE POLICY "Admins can insert app_settings"
ON public.app_settings
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update app_settings"
ON public.app_settings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete app_settings"
ON public.app_settings
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger de updated_at
CREATE TRIGGER trg_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Seed das metas atuais
INSERT INTO public.app_settings (key, value) VALUES
  ('metas', '{"slaNoPrazo":80,"maxCritico":10,"tempoMedioMax":18}'::jsonb)
ON CONFLICT (key) DO NOTHING;
