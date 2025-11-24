-- Check automation configuration
-- Run this in Supabase SQL Editor to diagnose automation issues

-- 1. Check if app_config is set up correctly for webhooks
SELECT * FROM public.app_config;

-- 2. Check all columns on your boards (look for the status column)
SELECT
  b.name as board_name,
  c.id as column_id,
  c.name as column_name,
  c.type as column_type
FROM public.columns c
JOIN public.boards b ON c.board_id = b.id
WHERE c.type = 'status'
ORDER BY b.name, c.position;

-- 3. Check existing automations and their trigger configs
SELECT
  a.id as automation_id,
  a.name as automation_name,
  a.is_active,
  b.name as board_name,
  a.trigger_type,
  a.trigger_config,
  a.action_type,
  a.action_config
FROM public.automations a
JOIN public.boards b ON a.board_id = b.id
ORDER BY b.name, a.name;

-- 4. Check recent automation events (last 10)
SELECT
  ae.id,
  ae.board_id,
  ae.item_id,
  ae.column_id,
  c.name as column_name,
  ae.old_value,
  ae.new_value,
  ae.created_at,
  ae.processed_at
FROM public.automation_events ae
LEFT JOIN public.columns c ON ae.column_id = c.id
ORDER BY ae.created_at DESC
LIMIT 10;

-- 5. Check automation logs (last 10)
SELECT
  al.id,
  a.name as automation_name,
  al.status,
  al.message,
  al.created_at
FROM public.automation_logs al
LEFT JOIN public.automations a ON al.automation_id = a.id
ORDER BY al.created_at DESC
LIMIT 10;
