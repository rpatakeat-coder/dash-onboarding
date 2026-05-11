
-- Bootstrap: allow the very first user to claim the admin role (only when no admin exists yet)
create or replace function public.claim_first_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_has_admin boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select exists(select 1 from public.user_roles where role = 'admin') into v_has_admin;
  if v_has_admin then
    return false;
  end if;

  insert into public.user_roles (user_id, role)
  values (v_uid, 'admin')
  on conflict do nothing;

  return true;
end;
$$;

revoke all on function public.claim_first_admin() from public;
grant execute on function public.claim_first_admin() to authenticated;

-- Admin-only listing of users + their roles
create or replace function public.list_admin_users()
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  created_at timestamptz,
  roles text[]
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Forbidden';
  end if;

  return query
  select
    p.id,
    p.full_name,
    p.avatar_url,
    p.created_at,
    coalesce(array_agg(ur.role::text) filter (where ur.role is not null), '{}') as roles
  from public.profiles p
  left join public.user_roles ur on ur.user_id = p.id
  group by p.id, p.full_name, p.avatar_url, p.created_at
  order by p.created_at desc;
end;
$$;

revoke all on function public.list_admin_users() from public;
grant execute on function public.list_admin_users() to authenticated;
