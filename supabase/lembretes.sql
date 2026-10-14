-- Lembretes: corre a função "avisos" a cada 5 minutos só para os lembretes
-- (a rotina diária das 08:00 UTC continua igual, em notificacoes.sql)
select cron.unschedule('avisos-lembretes') where exists (select 1 from cron.job where jobname = 'avisos-lembretes');
select cron.schedule(
  'avisos-lembretes',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://putvpneoexwblbbqemer.supabase.co/functions/v1/avisos?lembretes=1',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb
     ) $$
);
