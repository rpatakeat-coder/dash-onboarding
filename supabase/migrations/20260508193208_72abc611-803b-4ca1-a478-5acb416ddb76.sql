
SELECT cron.unschedule('daily-risk-alert-webhook')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-risk-alert-webhook');

SELECT cron.schedule(
  'daily-risk-alert-webhook',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://shbhqzbizndbfjdqzhdg.supabase.co/functions/v1/send-daily-alert',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoYmhxemJpem5kYmZqZHF6aGRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNDIzMTQsImV4cCI6MjA4ODcxODMxNH0.sTeyQsk6st_Dqkq09nw9cn0Q6IJ427p-g5lXI8sUYgw"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
