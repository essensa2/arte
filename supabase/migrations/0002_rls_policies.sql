-- 0002_rls_policies.sql
-- RLS policies to restrict access to workspace members

-- Helper function: is_workspace_member
create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_workspace_memberships m
    where m.workspace_id = target_workspace
      and m.user_id = auth.uid()
  );
$$;

-- Enable RLS
alter table public.workspaces enable row level security;
alter table public.user_workspace_memberships enable row level security;
alter table public.boards enable row level security;
alter table public.columns enable row level security;
alter table public.items enable row level security;
alter table public.cell_values enable row level security;
alter table public.automations enable row level security;
alter table public.automation_logs enable row level security;
alter table public.webhook_subscriptions enable row level security;

-- Workspaces
drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces
  for select
  using (exists (
    select 1 from public.user_workspace_memberships m
    where m.workspace_id = workspaces.id
      and m.user_id = auth.uid()
  ));

drop policy if exists workspaces_insert on public.workspaces;
create policy workspaces_insert on public.workspaces
  for insert
  with check (auth.uid() is not null);

drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces
  for update
  using (exists (
    select 1 from public.user_workspace_memberships m
    where m.workspace_id = workspaces.id
      and m.user_id = auth.uid()
  ));

drop policy if exists workspaces_delete on public.workspaces;
create policy workspaces_delete on public.workspaces
  for delete
  using (exists (
    select 1 from public.user_workspace_memberships m
    where m.workspace_id = workspaces.id
      and m.user_id = auth.uid()
  ));

-- Memberships: users can see their memberships; inserts typically via app logic
drop policy if exists memberships_select on public.user_workspace_memberships;
create policy memberships_select on public.user_workspace_memberships
  for select
  using (user_id = auth.uid());

drop policy if exists memberships_insert on public.user_workspace_memberships;
create policy memberships_insert on public.user_workspace_memberships
  for insert
  with check (user_id = auth.uid());

drop policy if exists memberships_update on public.user_workspace_memberships;
create policy memberships_update on public.user_workspace_memberships
  for update using (user_id = auth.uid());

drop policy if exists memberships_delete on public.user_workspace_memberships;
create policy memberships_delete on public.user_workspace_memberships
  for delete using (user_id = auth.uid());

-- Boards
drop policy if exists boards_select on public.boards;
create policy boards_select on public.boards
  for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists boards_mutation on public.boards;
create policy boards_mutation on public.boards
  for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- Columns
drop policy if exists columns_all on public.columns;
create policy columns_all on public.columns
  for all
  using (public.is_workspace_member((select b.workspace_id from public.boards b where b.id = columns.board_id)))
  with check (public.is_workspace_member((select b.workspace_id from public.boards b where b.id = columns.board_id)));

-- Items
drop policy if exists items_all on public.items;
create policy items_all on public.items
  for all
  using (public.is_workspace_member((select b.workspace_id from public.boards b where b.id = items.board_id)))
  with check (public.is_workspace_member((select b.workspace_id from public.boards b where b.id = items.board_id)));

-- Cell values
drop policy if exists cell_values_all on public.cell_values;
create policy cell_values_all on public.cell_values
  for all
  using (public.is_workspace_member((
    select b.workspace_id
    from public.items i
    join public.boards b on b.id = i.board_id
    where i.id = cell_values.item_id
  )))
  with check (public.is_workspace_member((
    select b.workspace_id
    from public.items i
    join public.boards b on b.id = i.board_id
    where i.id = cell_values.item_id
  )));

-- Automations
drop policy if exists automations_all on public.automations;
create policy automations_all on public.automations
  for all
  using (public.is_workspace_member((select b.workspace_id from public.boards b where b.id = automations.board_id)))
  with check (public.is_workspace_member((select b.workspace_id from public.boards b where b.id = automations.board_id)));

-- Automation logs (visible if user has access to the automation's board/workspace)
drop policy if exists automation_logs_select on public.automation_logs;
create policy automation_logs_select on public.automation_logs
  for select
  using (exists (
    select 1
    from public.automations a
    join public.boards b on b.id = a.board_id
    where a.id = automation_logs.automation_id
      and public.is_workspace_member(b.workspace_id)
  ));

-- Webhook subscriptions
drop policy if exists webhook_subscriptions_all on public.webhook_subscriptions;
create policy webhook_subscriptions_all on public.webhook_subscriptions
  for all
  using (public.is_workspace_member((select b.workspace_id from public.boards b where b.id = webhook_subscriptions.board_id)))
  with check (public.is_workspace_member((select b.workspace_id from public.boards b where b.id = webhook_subscriptions.board_id)));


