-- Fix automation configuration
-- This script will help you update automations to use the correct column

-- STEP 1: First, make sure app_config has the correct webhook URL
-- Update these values with your actual Supabase project details
UPDATE public.app_config
SET value = 'https://YOUR-PROJECT-REF.supabase.co/functions/v1'
WHERE key = 'SUPABASE_FUNCTIONS_URL';
-- IMPORTANT: Replace 'YOUR-PROJECT-REF' with your actual Supabase project reference

UPDATE public.app_config
SET value = 'YOUR-SERVICE-ROLE-KEY-HERE'
WHERE key = 'SUPABASE_SERVICE_ROLE_KEY';
-- IMPORTANT: Replace 'YOUR-SERVICE-ROLE-KEY-HERE' with your actual service role key from Supabase Dashboard > Settings > API
-- NEVER commit the actual service role key to git!

-- STEP 2: Find the correct column_id for your status column
-- Run this query first to find the column_id of your "status" column:
SELECT
  b.name as board_name,
  c.id as column_id,
  c.name as column_name
FROM public.columns c
JOIN public.boards b ON c.board_id = b.id
WHERE c.name ILIKE '%status%'  -- This will find columns with "status" in the name
ORDER BY b.name;

-- STEP 3: Update automations to use the correct column_id
-- Replace 'YOUR_CORRECT_COLUMN_ID' with the column_id from the query above
-- Replace 'YOUR_BOARD_ID' with your board's ID if needed

-- Example: Update all automations on a specific board to use the new status column
/*
UPDATE public.automations
SET trigger_config = jsonb_set(
  trigger_config,
  '{column_id}',
  '"YOUR_CORRECT_COLUMN_ID"'::jsonb
)
WHERE board_id = 'YOUR_BOARD_ID'
  AND trigger_type = 'STATUS_CHANGED';
*/

-- STEP 4: Verify the updates
SELECT
  a.name,
  a.trigger_config->>'column_id' as column_id,
  c.name as column_name,
  a.is_active
FROM public.automations a
LEFT JOIN public.columns c ON (a.trigger_config->>'column_id')::uuid = c.id
WHERE a.trigger_type = 'STATUS_CHANGED';
