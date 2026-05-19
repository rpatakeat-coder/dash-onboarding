
-- Fix search_path on remaining functions
ALTER FUNCTION public.match_documents(vector, integer, jsonb) SET search_path = public;
ALTER FUNCTION public.match_imoveis_vixtates(vector, double precision, integer) SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;

-- Revoke anon EXECUTE on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_operations_role(uuid, operations_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.list_operators() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_user_agente() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.distinct_agentes_ativacao() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_operations_role(uuid, operations_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_operators() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_agente() TO authenticated;
GRANT EXECUTE ON FUNCTION public.distinct_agentes_ativacao() TO authenticated;

-- Make avatars bucket private and lock down storage policies
UPDATE storage.buckets SET public = false WHERE id = 'avatars';

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;

CREATE POLICY "Authenticated can view avatars"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Users upload own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
