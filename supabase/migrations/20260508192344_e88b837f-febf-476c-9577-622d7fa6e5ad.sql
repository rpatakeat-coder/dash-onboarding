
CREATE TABLE IF NOT EXISTS public.dash_operacoes_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL,
  total int NOT NULL DEFAULT 0,
  mrr_total numeric NOT NULL DEFAULT 0,
  sla_medio numeric NOT NULL DEFAULT 0,
  pct_no_prazo numeric NOT NULL DEFAULT 0,
  band_critico int NOT NULL DEFAULT 0,
  band_atencao int NOT NULL DEFAULT 0,
  band_alerta int NOT NULL DEFAULT 0,
  band_saudavel int NOT NULL DEFAULT 0,
  por_etapa jsonb NOT NULL DEFAULT '[]'::jsonb,
  por_ativador jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_date)
);

ALTER TABLE public.dash_operacoes_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read snapshots"
  ON public.dash_operacoes_snapshots
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anon can read snapshots for embed"
  ON public.dash_operacoes_snapshots
  FOR SELECT
  TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_snapshots_date ON public.dash_operacoes_snapshots (snapshot_date DESC);
