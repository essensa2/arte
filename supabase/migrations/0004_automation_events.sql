-- 0004_automation_events.sql
-- Event queue and trigger for cell value changes

create table if not exists public.automation_events (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null,
  item_id uuid not null,
  column_id uuid not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists idx_automation_events_board_created on public.automation_events(board_id, created_at);
alter table public.automation_events enable row level security;

drop policy if exists automation_events_select on public.automation_events;
create policy automation_events_select on public.automation_events
  for select
  using (public.is_workspace_member((
    select b.workspace_id from public.boards b where b.id = automation_events.board_id
  )));

-- Allow inserts via trigger (owned by table owner), edge function (service role bypasses RLS)
drop policy if exists automation_events_insert on public.automation_events;
create policy automation_events_insert on public.automation_events
  for insert
  with check (true);

-- Trigger to enqueue on cell value updates (and inserts)
create or replace function public.enqueue_cell_change()
returns trigger
language plpgsql
as $$
declare
  v_board uuid;
  v_item_board uuid;
begin
  -- Only enqueue on INSERT or UPDATE where value changed
  if (tg_op = 'UPDATE' and coalesce(to_jsonb(old.value), 'null'::jsonb) = coalesce(to_jsonb(new.value), 'null'::jsonb)) then
    return new;
  end if;
  select i.board_id into v_item_board from public.items i where i.id = new.item_id;
  insert into public.automation_events (board_id, item_id, column_id, old_value, new_value)
  values (v_item_board, new.item_id, new.column_id, case when tg_op='UPDATE' then to_jsonb(old.value) else null end, to_jsonb(new.value));
  return new;
end
$$;

drop trigger if exists trg_cell_values_enqueue on public.cell_values;
create trigger trg_cell_values_enqueue
after insert or update on public.cell_values
for each row execute function public.enqueue_cell_change();


