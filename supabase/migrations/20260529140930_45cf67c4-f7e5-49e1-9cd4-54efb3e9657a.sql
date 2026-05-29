CREATE TABLE public.hubspot_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  hubspot_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (name),
  UNIQUE (hubspot_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hubspot_agents TO authenticated;
GRANT ALL ON public.hubspot_agents TO service_role;

ALTER TABLE public.hubspot_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read hubspot_agents"
ON public.hubspot_agents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Ops admins can insert hubspot_agents"
ON public.hubspot_agents FOR INSERT TO authenticated
WITH CHECK (has_operations_role(auth.uid(), 'admin'::operations_role));

CREATE POLICY "Ops admins can update hubspot_agents"
ON public.hubspot_agents FOR UPDATE TO authenticated
USING (has_operations_role(auth.uid(), 'admin'::operations_role))
WITH CHECK (has_operations_role(auth.uid(), 'admin'::operations_role));

CREATE POLICY "Ops admins can delete hubspot_agents"
ON public.hubspot_agents FOR DELETE TO authenticated
USING (has_operations_role(auth.uid(), 'admin'::operations_role));

CREATE OR REPLACE FUNCTION public.set_hubspot_agents_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_hubspot_agents_updated_at
BEFORE UPDATE ON public.hubspot_agents
FOR EACH ROW EXECUTE FUNCTION public.set_hubspot_agents_updated_at();