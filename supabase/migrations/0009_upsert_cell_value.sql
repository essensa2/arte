-- 0009_upsert_cell_value.sql
-- Function to safely upsert cell values, ensuring null is treated as JSONB null

create or replace function public.upsert_cell_value(
  p_item_id uuid,
  p_column_id uuid,
  p_value jsonb
)
returns void
language plpgsql
security definer
as $$
begin
  -- Ensure value is always valid JSONB (not SQL NULL)
  -- If p_value is SQL NULL, use JSONB null instead
  insert into public.cell_values (item_id, column_id, value)
  values (p_item_id, p_column_id, coalesce(p_value, 'null'::jsonb))
  on conflict (item_id, column_id)
  do update set
    value = coalesce(p_value, 'null'::jsonb),
    updated_at = now();
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.upsert_cell_value(uuid, uuid, jsonb) to authenticated;

