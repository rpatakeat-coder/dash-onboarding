
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('daily-dash-operacoes-snapshot')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-dash-operacoes-snapshot');

SELECT cron.schedule(
  'daily-dash-operacoes-snapshot',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://shbhqzbizndbfjdqzhdg.supabase.co/functions/v1/snapshot-dash-operacoes',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoYmhxemJpem5kYmZqZHF6aGRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNDIzMTQsImV4cCI6MjA4ODcxODMxNH0.sTeyQsk6st_Dqkq09nw9cn0Q6IJ427p-g5lXI8sUYgw"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
