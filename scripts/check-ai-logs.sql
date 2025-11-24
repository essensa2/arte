-- Check for AI-related log messages
SELECT
  al.id,
  al.status,
  al.message,
  al.created_at,
  a.name as automation_name,
  a.action_config
FROM automation_logs al
LEFT JOIN automations a ON a.id = al.automation_id
WHERE al.message LIKE '%AI%'
   OR al.message LIKE '%filled%'
   OR al.message LIKE '%field%'
ORDER BY al.created_at DESC
LIMIT 20;

-- Check for automations with AI config
SELECT
  a.id,
  a.name,
  a.is_active,
  a.action_config
FROM automations a
WHERE a.action_config::text LIKE '%ai_instructions%'
   OR a.action_config::text LIKE '%AI_FILL_FIELDS%';
