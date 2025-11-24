-- Check if there are any AI automations configured
SELECT
  a.id,
  a.name,
  a.is_active,
  a.trigger_type,
  a.trigger_config,
  a.action_type,
  a.action_config,
  b.name as board_name
FROM automations a
JOIN boards b ON b.id = a.board_id
WHERE a.action_config::text LIKE '%AI_FILL_FIELDS%'
   OR a.action_type = 'AI_FILL_FIELDS'
ORDER BY a.created_at DESC;

-- If no AI automations, show all automations
SELECT
  a.id,
  a.name,
  a.is_active,
  a.trigger_type,
  a.trigger_config->'target_status' as target_status,
  a.action_type,
  b.name as board_name
FROM automations a
JOIN boards b ON b.id = a.board_id
ORDER BY a.created_at DESC
LIMIT 10;
