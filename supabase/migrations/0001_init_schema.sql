-- 0001_init_schema.sql
-- Core schema for workspaces, boards, columns, items, cell values, automations, logs
-- Notes:
-- - Single-tenant app with multi-workspace support
-- - Uses JSONB for cell_values.value to keep column types flexible
-- - RLS: membership-based access per workspace

-- Extensions
create extension if not exists pgcrypto;

-- Helper: restrict column types via CHECK
-- Allowed: text, long_text, number, money, status, email, date, checkbox
create domain column_type as text
  check (value in ('text','long_text','number','money','status','email','date','checkbox'));

-- Users: from Supabase Auth, not created here

-- Workspaces
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Memberships
create table if not exists public.user_workspace_memberships (
  user_id uuid not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (user_id, workspace_id)
);
create index if not exists idx_user_workspace_memberships_workspace on public.user_workspace_memberships(workspace_id);
create index if not exists idx_user_workspace_memberships_user on public.user_workspace_memberships(user_id);

-- Boards
create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_boards_workspace on public.boards(workspace_id);

-- Columns
create table if not exists public.columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null,
  type column_type not null,
  position integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_columns_board on public.columns(board_id);
create index if not exists idx_columns_board_position on public.columns(board_id, position);

-- Items
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  due_date date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_items_board on public.items(board_id);
create index if not exists idx_items_board_position on public.items(board_id, position);
create index if not exists idx_items_archived on public.items(archived_at);

-- Cell values
create table if not exists public.cell_values (
  item_id uuid not null references public.items(id) on delete cascade,
  column_id uuid not null references public.columns(id) on delete cascade,
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (item_id, column_id)
);
create index if not exists idx_cell_values_item on public.cell_values(item_id);
create index if not exists idx_cell_values_column on public.cell_values(column_id);

-- Automations
create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  trigger_type text not null,    -- e.g., STATUS_CHANGED
  trigger_config jsonb not null, -- e.g., {\"column_id\": \"...\", \"target_status\": \"Done\"}
  action_type text not null,     -- e.g., MOVE_TO_BOARD or CALL_WEBHOOK
  action_config jsonb not null,  -- e.g., {\"dest_board_id\": \"...\", \"new_status\": \"Archived\"}
  created_at timestamptz not null default now()
);
create index if not exists idx_automations_board on public.automations(board_id);

-- Automation logs
create table if not exists public.automation_logs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references public.automations(id) on delete set null,
  status text not null, -- e.g., success | error
  message text,
  created_at timestamptz not null default now()
);
create index if not exists idx_automation_logs_automation on public.automation_logs(automation_id);

-- Optional: webhook subscriptions
create table if not exists public.webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  url text not null,
  secret text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_webhook_subscriptions_board on public.webhook_subscriptions(board_id);

-- Updated at triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_columns_updated_at on public.columns;
create trigger trg_columns_updated_at
before update on public.columns
for each row execute function public.set_updated_at();

drop trigger if exists trg_items_updated_at on public.items;
create trigger trg_items_updated_at
before update on public.items
for each row execute function public.set_updated_at();


