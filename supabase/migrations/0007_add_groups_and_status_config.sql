-- 0007_add_groups_and_status_config.sql
-- Add support for item groups and status column configuration

-- Add group_id to items table
alter table public.items add column if not exists group_id uuid;

-- Create groups table
create table if not exists public.groups (
    id uuid primary key default gen_random_uuid (),
    board_id uuid not null references public.boards (id) on delete cascade,
    name text not null,
    position integer not null default 0,
    color text,
    collapsed boolean not null default false,
    created_at timestamptz not null default now()
);

create index if not exists idx_groups_board on public.groups (board_id);

create index if not exists idx_groups_board_position on public.groups (board_id, position);

-- Add foreign key for group_id in items
alter table public.items
add constraint fk_items_group foreign key (group_id) references public.groups (id) on delete set null;

create index if not exists idx_items_group on public.items (group_id);

-- RLS policies for groups
alter table public.groups enable row level security;

drop policy if exists groups_all on public.groups;

create policy groups_all on public.groups for all using (
    public.is_workspace_member (
        (
            select b.workspace_id
            from public.boards b
            where
                b.id = groups.board_id
        )
    )
)
with
    check (
        public.is_workspace_member (
            (
                select b.workspace_id
                from public.boards b
                where
                    b.id = groups.board_id
            )
        )
    );

-- Update column config to support status options
-- The config JSONB field can now store: { "status_options": [{"label": "Done", "color": "#00c875"}, ...] }
-- No schema change needed, just documentation that status columns should use this structure