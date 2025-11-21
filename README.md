## ArtePay Boards (Next.js + Supabase)

A modern board and table management system with automations, built with Next.js and Supabase.

### Prerequisites
- Node 18+ and pnpm or npm
- Supabase project (we use `ArtePay`)

### 1) Local Setup
1. Install deps: `pnpm i` or `npm i`
2. Copy `ENV.example` to `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_FUNCTIONS_URL`
3. Start dev server: `pnpm dev` or `npm run dev`

### 2) Database Migrations
Migrations live in `supabase/migrations`.
Order:
1. `0001_init_schema.sql`
2. `0002_rls_policies.sql`
3. `0003_seed_example.sql` (optional)
4. `0004_automation_events.sql`

Apply options:
- Supabase SQL Editor: paste each file in order.
- Supabase CLI: `supabase db push` (if using local), or run with `psql` against remote DB.
- MCP (used here): applied in order to the `ArtePay` project.

### 3) Edge Function: Automations
Location: `supabase/functions/automation/index.ts`
- Implements minimal engine:
  - Trigger: `STATUS_CHANGED` on a selected status column
  - Actions:
    - `MOVE_TO_BOARD` (copy item + cells, optional new status, archive source)
    - `CALL_WEBHOOK` (POST to URL with optional JSON payload)
  - Logs to `automation_logs`
  - Consumes events from `automation_events` (queued by DB trigger on `cell_values`)

Deploy:
- Supabase CLI (recommended):
  - `supabase functions deploy automation`
  - Ensure `SUPABASE_FUNCTIONS_URL` is set in `.env.local`

Invoke (temporary trigger route for manual run/testing):
- POST `/api/automation/process` with JSON `{ "board_id": "<uuid>" }`

### 4) App Structure (selected)
- `app/` Next.js App Router pages
  - `sign-in`: email+password auth
  - `workspaces`: create/list workspaces (RLS enforced)
  - `w/[workspaceId]/boards`: boards list + create, rename, delete
  - `w/[workspaceId]/b/[boardId]`: board table view
  - `w/[workspaceId]/b/[boardId]/settings/automations`: create/list automations; run now
- `components/board/BoardTable.tsx`: columns + items + cell editors, optimistic updates
- `components/ui/`: reusable UI components (Button, EmptyState, Toaster)
- `lib/supabase`: browser/server clients
- `supabase/migrations`: SQL schema + RLS + events
- `supabase/functions/automation`: Edge Function for automations

### 5) MVP Usage
1. Sign up/in at `/sign-in`
2. Create a workspace, then a board
3. Add columns/items; edit cells inline
4. In board settings → Automations:
   - Create a `STATUS_CHANGED` rule for a status column with target value (e.g., Done)
   - Choose action:
     - Move to another board (optional new status on destination)
     - Call webhook (URL + optional JSON payload)
5. Change an item's status to the target; run automations (temporary "Run automations" button) or rely on queue + function worker when attached to your scheduling/trigger.

### 6) UI/UX Improvements (Phase 8)
- **Modern Design**: Clean, polished interface with consistent styling
- **Empty States**: Helpful messages when no workspaces, boards, or items exist
- **Loading States**: Skeleton loaders for better perceived performance
- **Money Formatting**: EUR currency formatting for money columns (display only)
- **Accessibility**: Focus states, keyboard navigation, ARIA labels
- **Sign Out**: Proper sign-out functionality with user email display
- **Responsive**: Works on desktop and mobile devices

### 7) Notes & Defaults
- Money columns default currency: EUR (formatting only; stored numeric as JSON number within cell value)
- RLS: membership-based access via `user_workspace_memberships` and `public.is_workspace_member`
- Automation loops: writes from function act as system updates; engine selects events and marks them processed

### 8) Known Limitations / Future Improvements
- Drag-and-drop UX for ordering (currently move up/down/left/right buttons)
- Destination status column selection assumes same structure; can map columns across boards later
- Scheduler/trigger for Edge Function (e.g., cron) to process events automatically
- Better error toasts and granular retry/backoff for webhooks
- Real-time collaboration (multiple users editing same board)

### 9) Troubleshooting
- **Authentication errors**: Ensure Supabase URL and anon key are correct in `.env.local`
- **RLS errors**: Check that user has workspace membership
- **Automation not running**: Verify Edge Function is deployed and `SUPABASE_FUNCTIONS_URL` is set
- **Money formatting not showing**: Ensure column type is set to `money` and value is numeric


