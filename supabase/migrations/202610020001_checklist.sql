begin;

create table if not exists public.checklist_records (
  record_key text primary key,
  value jsonb not null,
  revision integer not null default 1,
  mutation_id text not null,
  updated_at timestamptz not null default now()
);

alter table public.checklist_records enable row level security;
revoke all on public.checklist_records from public, anon, authenticated;
grant select, insert, update on public.checklist_records to service_role;

-- Um resultado JSON agrega o histórico todo, sem o limite de linhas da Data API.
create or replace function public.checklist_list()
returns jsonb language sql security invoker set search_path = '' as $$
  select coalesce(jsonb_object_agg(record_key, value || jsonb_build_object('revision', revision)), '{}'::jsonb)
  from public.checklist_records;
$$;

create or replace function public.checklist_save(
  p_key text, p_value jsonb, p_base_revision integer, p_mutation_id text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  saved public.checklist_records%rowtype;
begin
  insert into public.checklist_records as current_record (record_key, value, revision, mutation_id)
  select p_key, p_value, 1, p_mutation_id
  where p_base_revision = 0 or exists (select 1 from public.checklist_records where record_key = p_key)
  on conflict (record_key) do update
  set value = excluded.value, revision = current_record.revision + 1,
      mutation_id = excluded.mutation_id, updated_at = now()
  where current_record.revision = p_base_revision and current_record.mutation_id <> p_mutation_id
  returning * into saved;

  if found then
    return jsonb_build_object('conflict', false, 'record', saved.value || jsonb_build_object('revision', saved.revision));
  end if;

  select * into saved from public.checklist_records where record_key = p_key;
  if not found then
    return jsonb_build_object('conflict', true, 'record', null);
  end if;
  return jsonb_build_object('conflict', saved.mutation_id <> p_mutation_id,
    'record', saved.value || jsonb_build_object('revision', saved.revision));
end;
$$;

revoke all on function public.checklist_list() from public, anon, authenticated;
revoke all on function public.checklist_save(text, jsonb, integer, text) from public, anon, authenticated;
grant execute on function public.checklist_list() to service_role;
grant execute on function public.checklist_save(text, jsonb, integer, text) to service_role;

commit;
