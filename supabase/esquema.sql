-- Estrutura da base de dados da app Assistente (Supabase)
-- Cada registo (nota, conta, movimento, ...) fica numa linha, associado ao utilizador.

create table if not exists public.registos (
  user_id     uuid   not null default auth.uid() references auth.users on delete cascade,
  tabela      text   not null,
  id          text   not null,
  dados       jsonb,
  atualizado  bigint not null,
  apagado     boolean not null default false,
  servidor_em timestamptz not null default now(),
  primary key (user_id, tabela, id)
);

create index if not exists registos_sync on public.registos (user_id, servidor_em);

-- Atualiza a hora do servidor sempre que um registo muda (usado na sincronização)
create or replace function public.registos_marcar() returns trigger
language plpgsql as $$
begin
  new.servidor_em := now();
  return new;
end $$;

drop trigger if exists registos_marcar on public.registos;
create trigger registos_marcar before insert or update on public.registos
for each row execute function public.registos_marcar();

-- Segurança: cada pessoa só vê e altera os seus próprios dados
alter table public.registos enable row level security;

drop policy if exists "ver os meus" on public.registos;
drop policy if exists "criar os meus" on public.registos;
drop policy if exists "alterar os meus" on public.registos;
drop policy if exists "apagar os meus" on public.registos;

create policy "ver os meus" on public.registos for select to authenticated
  using (user_id = auth.uid());
create policy "criar os meus" on public.registos for insert to authenticated
  with check (user_id = auth.uid());
create policy "alterar os meus" on public.registos for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "apagar os meus" on public.registos for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.registos from anon;
grant select, insert, update, delete on public.registos to authenticated;
