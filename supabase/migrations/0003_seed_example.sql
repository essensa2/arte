-- 0003_seed_example.sql
-- Optional seed: one workspace, one board, a couple columns and items to smoke test

do $$
declare
  ws_id uuid := gen_random_uuid();
  b_id uuid := gen_random_uuid();
  c_status uuid := gen_random_uuid();
  c_money uuid := gen_random_uuid();
begin
  insert into public.workspaces(id, name) values (ws_id, 'Demo Workspace');
  -- NOTE: app should insert current user membership after auth; seed leaves memberships empty

  insert into public.boards(id, workspace_id, name) values (b_id, ws_id, 'Demo Board');

  insert into public.columns(id, board_id, name, type, position, config)
    values (c_status, b_id, 'Status', 'status', 0, jsonb_build_object('labels', jsonb_build_array('To Do','In Progress','Done')));
  insert into public.columns(id, board_id, name, type, position, config)
    values (c_money, b_id, 'Budget', 'money', 1, jsonb_build_object('currency', 'EUR'));

  insert into public.items(id, board_id, name, position) values (gen_random_uuid(), b_id, 'First task', 0);
  insert into public.items(id, board_id, name, position) values (gen_random_uuid(), b_id, 'Second task', 1);
end $$;


