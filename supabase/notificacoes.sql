-- Notificações (Web Push) da app Assistente

-- Aparelhos onde as notificações estão ativas
create table if not exists public.subscricoes (
  endpoint text primary key,
  user_id  uuid not null default auth.uid() references auth.users on delete cascade,
  dados    jsonb not null,
  criada   timestamptz not null default now()
);
alter table public.subscricoes enable row level security;
drop policy if exists "ver as minhas" on public.subscricoes;
drop policy if exists "criar as minhas" on public.subscricoes;
drop policy if exists "alterar as minhas" on public.subscricoes;
drop policy if exists "apagar as minhas" on public.subscricoes;
create policy "ver as minhas" on public.subscricoes for select to authenticated using (user_id = auth.uid());
create policy "criar as minhas" on public.subscricoes for insert to authenticated with check (user_id = auth.uid());
create policy "alterar as minhas" on public.subscricoes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "apagar as minhas" on public.subscricoes for delete to authenticated using (user_id = auth.uid());
revoke all on public.subscricoes from anon;
grant select, insert, update, delete on public.subscricoes to authenticated;

-- Registo das notificações já enviadas (para não repetir) — só a função lhe acede
create table if not exists public.notificacoes_enviadas (
  chave   text primary key,
  enviada timestamptz not null default now()
);
alter table public.notificacoes_enviadas enable row level security;
revoke all on public.notificacoes_enviadas from anon, authenticated;

-- Configuração privada (chaves das notificações, criadas pela própria função) — só a função lhe acede
create table if not exists public.config_privada (
  chave text primary key,
  valor text not null
);
alter table public.config_privada enable row level security;
revoke all on public.config_privada from anon, authenticated;

-- Corre a função "avisos" todos os dias às 08:00 UTC (9h em Lisboa no verão, 8h no inverno)
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('avisos-depositos') where exists (select 1 from cron.job where jobname = 'avisos-depositos');
select cron.schedule(
  'avisos-depositos',
  '0 8 * * *',
  $$ select net.http_post(
       url := 'https://putvpneoexwblbbqemer.supabase.co/functions/v1/avisos',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb
     ) $$
);
