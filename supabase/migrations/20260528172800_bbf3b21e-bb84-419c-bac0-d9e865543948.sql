
-- 1) Avatars: drop the public SELECT policy (authenticated policy remains)
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

-- 2) Tighten dash_* tables to admin + viewer
DROP POLICY IF EXISTS "Authenticated can read snapshots" ON public.dash_operacoes_snapshots;

CREATE POLICY "Admins read dash_operacoes_snapshots"
  ON public.dash_operacoes_snapshots FOR SELECT TO authenticated
  USING (public.has_operations_role(auth.uid(), 'admin'::public.operations_role));
CREATE POLICY "Viewers read dash_operacoes_snapshots"
  ON public.dash_operacoes_snapshots FOR SELECT TO authenticated
  USING (public.has_operations_role(auth.uid(), 'viewer'::public.operations_role));

CREATE POLICY "Admins read dash_operacoes_backup"
  ON public.dash_operacoes_backup FOR SELECT TO authenticated
  USING (public.has_operations_role(auth.uid(), 'admin'::public.operations_role));

CREATE POLICY "Admins read dash_sucesso"
  ON public.dash_sucesso FOR SELECT TO authenticated
  USING (public.has_operations_role(auth.uid(), 'admin'::public.operations_role));
CREATE POLICY "Viewers read dash_sucesso"
  ON public.dash_sucesso FOR SELECT TO authenticated
  USING (public.has_operations_role(auth.uid(), 'viewer'::public.operations_role));

-- 3) Restrict CRM/Hubspot tables to admin + viewer
DROP POLICY IF EXISTS "Authenticated users can read vendas" ON public."Vendas";
DROP POLICY IF EXISTS "Authenticated users can read ligacoes" ON public."Ligações Realizadas";
DROP POLICY IF EXISTS "Authenticated users can read all lost deals" ON public."Relatório Perdidos";
DROP POLICY IF EXISTS "Authenticated users can read leads" ON public."Leads Criados Hubspot";
DROP POLICY IF EXISTS "Authenticated users can read meetings" ON public."Reuniões Marcadas";

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'Vendas','Vendas Hubspot','Ligações Realizadas','Relatório Perdidos',
    'Leads Criados Hubspot','Reuniões Marcadas'
  ])
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_operations_role(auth.uid(), ''admin''::public.operations_role));',
      'Admins read '||t, t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_operations_role(auth.uid(), ''viewer''::public.operations_role));',
      'Viewers read '||t, t
    );
  END LOOP;
END $$;

-- Drop existing blanket policy on Vendas Hubspot if it exists (not listed but to be safe)
DROP POLICY IF EXISTS "Authenticated users can read vendas hubspot" ON public."Vendas Hubspot";

-- 4) Recreate views with security_invoker so they respect caller RLS
ALTER VIEW public.vw_sucesso_overview SET (security_invoker = on);
ALTER VIEW public.vw_sucesso_qa_sem_perfil SET (security_invoker = on);
