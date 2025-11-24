-- 0005_automation_webhook.sql
-- Enable pg_net for webhooks
create extension if not exists pg_net with schema extensions;

-- Create a trigger to call the Edge Function on new automation events
create or replace function public.trigger_automation_webhook()
returns trigger
language plpgsql
security definer
as $$
declare
  v_url text;
  v_service_key text;
begin
  -- You typically store these in a secrets table or use a known env var approach if possible in PL/PGSQL.
  -- For this MVP, we will assume the URL is passed or hardcoded, OR we use the vault if available.
  -- However, Supabase Edge Functions URL is predictable: https://<project-ref>.supabase.co/functions/v1/automation
  -- AND we need the service role key.
  
  -- CRITICAL: In a real production app, DO NOT hardcode keys in migrations.
  -- But since we cannot easily access .env from SQL, and this is an MVP:
  -- We will use a placeholder that the user must replace, OR we rely on the fact that
  -- we might not need the key if the function is public (bad) or if we use `net.http_post`.
  
  -- BETTER APPROACH for MVP:
  -- Just notify the function. The function itself checks for unprocessed events.
  -- We don't strictly need to send the payload, just a "wake up" call.
  
  -- We will use a generic "wake up" call.
  -- NOTE: Replace PROJECT_REF and ANON_KEY/SERVICE_KEY with actual values if running manually.
  -- Since we are in an AI agent context, we might not have the project ref easily.
  -- Let's check if we can get it from a table or config.
  
  -- For now, we will create the function but leave the URL configurable or use a dummy one
  -- that the user must update, OR we try to infer it.
  
  -- Actually, `pg_net` requests are async.
  -- Let's assume the user has `vault` or we can just use a simplified approach.
  
  -- SIMPLIFICATION:
  -- We will use `pg_net` to POST to the function.
  -- We need the URL.
  
  -- Let's try to find the project URL from `storage.buckets` or similar if possible? No.
  
  -- We will assume a standard placeholder that needs to be replaced, 
  -- OR we can use a table `public.app_config` to store the URL and Key.
  
  return new;
end
$$;

-- Wait, I need to actually implement it.
-- Let's create a table for config so we don't hardcode secrets in the function body.
create table if not exists public.app_config (
    key text primary key,
    value text not null
);

-- Insert placeholders if not exist
insert into
    public.app_config (key, value)
values (
        'SUPABASE_FUNCTIONS_URL',
        'https://YOUR_PROJECT_REF.supabase.co/functions/v1'
    ),
    (
        'SUPABASE_SERVICE_ROLE_KEY',
        'YOUR_SERVICE_ROLE_KEY'
    ) on conflict do nothing;

create or replace function public.trigger_automation_webhook()
returns trigger
language plpgsql
security definer
as $$
declare
  v_url text;
  v_key text;
  v_endpoint text;
  v_req_id bigint;
begin
  select value into v_url from public.app_config where key = 'SUPABASE_FUNCTIONS_URL';
  select value into v_key from public.app_config where key = 'SUPABASE_SERVICE_ROLE_KEY';
  
  if v_url is null or v_key is null or v_url like '%YOUR_%' then
    -- Config not set, skip
    return new;
  end if;

  v_endpoint := v_url || '/automation';

  -- Call the function. Body can be empty or contain board_id.
  -- We'll send board_id to optimize.
  perform net.http_post(
    url := v_endpoint,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object('board_id', new.board_id)
  );

  return new;
end
$$;

drop trigger if exists trg_automation_webhook on public.automation_events;

create trigger trg_automation_webhook
after insert on public.automation_events
for each row execute function public.trigger_automation_webhook();