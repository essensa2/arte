## ArtePay Boards – Build Roadmap (SaaS-ready, single-tenant)

Assumptions
- Next.js (App Router) + TypeScript for frontend and API routes.
- shadcn/ui + Tailwind for modern, minimal UI.
- Supabase for Auth, Postgres, RLS, Realtime. Edge Functions for automations/webhooks.
- Single-tenant app with multi-workspace support; no billing now.
- Currency default: EUR for money formatting (configurable later).
- Automations run via Edge Function invoked on DB changes; use an “actor/system” flag to avoid loops.

High-level Architecture
- Frontend: Next.js app, server components where helpful, client components for board/table interactions and realtime updates.
- Backend: Supabase Postgres + RLS, Edge Functions for automation execution and outbound webhooks, Realtime (row-level) events to trigger automations.
- Data model: users, workspaces, user_workspace_memberships, boards, columns, items, cell_values, automations, automation_logs, webhook_subscriptions (optional).

Phases & Milestones

Phase 0 — Repo Scaffolding and Tooling (Day 0) ✅
- Initialize Next.js (App Router) + TypeScript, Tailwind, shadcn/ui.
- Project config: ESLint, Prettier, tsconfig, environment variables.
- Supabase client setup with URL and anon key; server helper for service role (Edge only).
- Deliverables:
  - Next.js app running locally, UI baseline.
  - .env.example with SUPABASE_URL and SUPABASE_ANON_KEY.

Phase 1 — Database Schema + RLS (Day 1) ✅
- Create SQL migrations for:
  - workspaces, user_workspace_memberships
  - boards (workspace_id), columns (board_id), items (board_id)
  - cell_values (item_id, column_id, jsonb value)
  - automations and automation_logs
  - webhook_subscriptions (optional)
- RLS Policies:
  - Users can only see/modify data within workspaces they belong to.
  - Secure write ops; ensure safe cross-board move via server-side function or policies.
- Deliverables:
  - Migrations to create schema and RLS, seed optional status labels.
  - README notes on applying migrations.

Phase 2 — Auth & Workspace UX (Day 2) ✅
- Auth pages: email/password sign in/up using Supabase UI or custom forms.
- Workspace list + selection (persist selection in URL or local storage).
- Deliverables:
  - /auth routes, protected routes pattern.
  - /workspaces list page and selection flow.

Phase 3 — Boards CRUD (Day 2–3) ✅
- List boards for selected workspace.
- Create/rename/delete boards (confirm destructive actions).
- Deliverables:
  - /w/[workspaceId]/boards page with CRUD.

Phase 4 — Board Table View (Day 3–5) ✅
- Render header (columns) and rows (items) with sticky first column.
- Horizontal scroll for many columns; responsive layout.
- Column management:
  - Add new column (type: text, long_text, number, money, status, email, date, checkbox).
  - Rename, reorder (drag-and-drop), delete (confirm).
- Items management:
  - Add item at top/bottom, inline rename, delete (confirm), reorder via drag-and-drop.
- Cell editors:
  - text/long_text: input/textarea
  - number: numeric input with validation
  - money: numeric input + EUR formatting on blur
  - status: dropdown with colored labels
  - email: email validation
  - date: date picker
  - checkbox: toggle
- Optimistic updates and toasts for errors.
- Deliverables:
  - Fully usable board table with CRUD.

Phase 5 — Automations (Day 5–7) ✅
- Minimum rule:
  - Trigger: STATUS_CHANGED on a selected status column; condition new_status == 'Done'.
  - Actions:
    1) Move item to another board/group (copy item + cell_values).
    2) Optionally set a new status on destination.
    3) Optionally archive/delete original item (choose archive for safety).
- Implementation:
  - DB trigger emits events (or use Supabase Realtime on item/cell change).
  - Edge Function consumes change events, evaluates board automations, executes actions.
  - Use metadata flag (e.g., automation_actor_id or x-automation) to avoid retrigger loops.
  - Log success/failure to automation_logs.
- Deliverables:
  - Edge Function deployed.
  - DB trigger or Realtime subscription path configured.
  - Rule works end-to-end.

Phase 6 — Webhooks (Day 7–8) ✅
- Automation action: CALL_WEBHOOK with URL and payload template (string).
- Edge Function posts to external URL; retries basic network errors (simple backoff).
- Log results (status, timestamp, error_message) to automation_logs.
- Deliverables:
  - Working webhook action.
  - Logs visible in DB; simple UI to view logs (MVP optional).

Phase 7 — Automation UI (MVP) (Day 8–9) ✅
- In board settings:
  - Create/Edit automations:
    - Trigger type dropdown (hard-code STATUS_CHANGED for MVP).
    - Select status column and target status value (e.g., Done).
    - Choose action:
      - Move to another board/group (+ optional new status)
      - Call webhook (+ URL, optional JSON payload template)
  - List existing automations: name, active toggle, edit/delete.
- Deliverables:
  - Usable automations UI with server persistence.

Phase 8 — Polish, Docs, and Hardening (Day 9–10) ⏳
- Loading and error states; empty states.
- Accessibility passes for inputs and menu controls.
- README:
  - Running locally
  - Applying migrations
  - Configuring Supabase
  - Known limitations and future improvements
- Deliverables:
  - Clean, readable code with comments on complex parts.

Database Entities (Summary)
- users (Supabase auth)
- workspaces
- user_workspace_memberships (user_id, workspace_id, role)
- boards (id, workspace_id, name, created_at, updated_at)
- columns (id, board_id, name, type, position, config_json)
- items (id, board_id, name, position, due_date, created_at, updated_at, archived_at)
- cell_values (item_id, column_id, value_jsonb)
- automations (id, board_id, name, is_active, trigger_type, trigger_config, action_type, action_config, created_at)
- automation_logs (id, automation_id, status, message, created_at)
- webhook_subscriptions (id, board_id, url, secret, is_active, created_at) — optional

RLS Overview (Summary)
- Each table keyed by workspace via join (e.g., boards.workspace_id).
- Policy pattern:
  - Check membership exists for current auth.uid() in user_workspace_memberships for the associated workspace.
  - Read/write limited to same-workspace rows.
  - Edge Function (service role) can bypass RLS for controlled actions (e.g., move item).

Key Risks and Mitigations
- Automation loops: Use “automation/system actor” flag and exclude those writes from triggers or short-circuit evaluation.
- Ordering integrity for items/columns: Use integer positions with gaps; compact on demand.
- Realtime noise: Filter events to relevant board/columns; debounce client updates.
- Webhook failures: Log with status and error message; surface minimal UI for visibility.

Success Criteria (MVP)
- Create a workspace, create boards, add columns, add items, edit cells inline.
- Status change to Done triggers automation: item moved to another board and/or webhook called; logs recorded.
- Users only see data in workspaces they belong to.

Next Steps (Execution Order)
1) Initialize Next.js + shadcn/ui + Supabase client (Phase 0).
2) Author SQL schema + RLS migrations (Phase 1).
3) Auth + workspace selection (Phase 2).
4) Boards CRUD (Phase 3).
5) Board table view + column/item CRUD + DnD + editors + optimistic UI (Phase 4).
6) Edge Function + Realtime/trigger pipeline + automation rule (Phase 5).
7) Webhook action + logs (Phase 6).
8) Automation settings UI (Phase 7).
9) README and polish (Phase 8).


