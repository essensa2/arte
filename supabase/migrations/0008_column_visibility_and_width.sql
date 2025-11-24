-- 0008_column_visibility_and_width.sql
-- Add column visibility and width configuration

-- Add hidden and width fields to columns table
alter table public.columns
add column if not exists hidden boolean not null default false;

alter table public.columns
add column if not exists width integer default 180;

-- Add index for querying visible columns
create index if not exists idx_columns_board_visible on public.columns (board_id, hidden);