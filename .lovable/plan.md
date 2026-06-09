## Tornar bucket `avatars` publicamente legível

Para que as fotos dos ativadores apareçam no modo TV (sem usuário autenticado), vou tornar o bucket `avatars` público apenas para leitura. Escrita continua restrita ao dono.

### Mudanças

**1. Atualizar bucket via tool nativa** (`supabase--storage_update_bucket`)
- `name: "avatars"`, `public: true`
- Observação: a flag `public` do bucket NÃO pode ser alterada via SQL (`UPDATE storage.buckets` é bloqueado pelo workspace). Por isso uso a tool dedicada em vez da migration que você esboçou no item 1.

**2. Migration SQL** — apenas para policies em `storage.objects`:
```sql
-- Remove policies de SELECT restritas (se existirem)
DROP POLICY IF EXISTS "Authenticated can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

-- Policy pública de leitura
CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');
```

**3. Não tocar** em policies de INSERT/UPDATE/DELETE — escrita segue restrita ao `auth.uid()` no primeiro nível da pasta.

### Verificação pós-migration
- Rodar o linter Supabase.
- Confirmar via `storage.objects` que apenas a policy `Public can view avatars` cobre SELECT no bucket; se houver outra policy de SELECT herdada (ex.: "Avatar images are publicly accessible"), te aviso antes de mexer.

### Aviso
Tornar o bucket público significa que qualquer pessoa com a URL do arquivo poderá visualizá-lo (sem listar o bucket). É o comportamento esperado para avatares exibidos em telão público.