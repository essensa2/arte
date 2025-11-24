-- Check recent automation logs
SELECT
  al.id,
  al.status,
  al.message,
  al.created_at,
  a.name as automation_name,
  a.action_config
FROM automation_logs al
LEFT JOIN automations a ON a.id = al.automation_id
ORDER BY al.created_at DESC
LIMIT 20;

-- Check recent automation events
SELECT
  ae.id,
  ae.board_id,
  ae.item_id,
  ae.column_id,
  ae.new_value,
  ae.processed_at,
  ae.created_at,
  c.name as column_name
FROM automation_events ae
LEFT JOIN columns c ON c.id = ae.column_id
ORDER BY ae.created_at DESC
LIMIT 20;
