-- 0006_create_workspace_function.sql
-- Function to create a workspace and automatically add the creator as owner

create or replace function public.create_workspace_with_membership(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
  current_user_id uuid;
begin
  -- Get the current user ID
  current_user_id := auth.uid();
  
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Insert the workspace
  insert into public.workspaces (name)
  values (workspace_name)
  returning id into new_workspace_id;

  -- Insert the membership
  insert into public.user_workspace_memberships (user_id, workspace_id, role)
  values (current_user_id, new_workspace_id, 'owner');

  return new_workspace_id;
end;
$$;