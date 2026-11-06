# Flowboard

A polished, responsive Kanban task manager built with React, TypeScript, dnd-kit and Supabase. Includes anonymous guest authentication, database-enforced user isolation, drag-and-drop task updates, task creation/editing/deletion, priority and due dates, search and filters, board statistics, and task comments.

## Requirements
- Node.js 20+ and npm
- Free Supabase project
- Free Vercel account for optional hosting

## 1. Configure Supabase
1. Create a project at https://supabase.com/dashboard.
2. Open **Authentication → Providers → Anonymous Sign-Ins** and enable anonymous users. (This is different from email sign-in.)
3. Open **SQL Editor**, paste `supabase/schema.sql`, and run it. The script creates `tasks`, `comments`, constraints, indexes, triggers and RLS policies.
4. Go to **Project Settings → API** (or **Connect** in newer dashboards). Copy the Project URL and **publishable/anon** key. **Never use the service_role/secret key in frontend code.**

## 2. Run locally
```bash
npm install
cp .env.example .env
```
Edit `.env`:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```
Then:
```bash
npm run dev
```
Open the URL Vite prints (usually http://localhost:5173). The app creates an anonymous user on first launch. Sessions persist in browser storage; clearing site storage creates a new user and therefore a different private workspace.

## 3. Deploy on Vercel
1. Push the **source code** to a GitHub repository. Keep `.env` out of Git; `.gitignore` already excludes it.
2. Import the repository into Vercel; framework preset **Vite**, build command `npm run build`, output directory `dist`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in Vercel. Redeploy after changing variables.
4. Open the deployed URL and test create, refresh, drag, edit, delete, comments and filters.

## Layout and interactions
The **Radial** view places the four required statuses around a central workspace hub (To Do at the top, In Progress left, In Review right, Done bottom). Drag a task by its six-dot handle and drop it into another status area; the update is persisted to Supabase. The central **Create task** button and each zone’s **+** button open the task form. Click a task to edit, delete, or comment. On narrow screens, zones stack for usability.

If you see **Invalid path specified in request URL**, verify that `VITE_SUPABASE_URL` is exactly the project base URL (`https://<project-ref>.supabase.co`) with no `/rest/v1`, `/auth/v1`, dashboard path, or quotes. Check Authentication > Providers > Anonymous Sign-Ins. Restart the Vite server after changing `.env`.

If you initialized Supabase with an earlier version of this repository, rerun `supabase/schema.sql` to add the task category column. Existing tasks receive the default category `general`.

## Feature checklist
- [x] Four status zones in Radial layout (To Do / In Progress / In Review / Done)
- [x] Drag tasks across columns and reorder within columns (persisted to Supabase)
- [x] Anonymous Supabase Auth and row-level security
- [x] Create, view, edit and delete tasks
- [x] Priority, description and due date
- [x] Search by title/description; filter by priority and due date
- [x] Total, in-progress, completed and overdue statistics
- [x] Comments saved to a separate, owner-protected table
- [x] Responsive layout, empty/loading/error states

## Security and verification
RLS is enabled on both tables. `tasks.user_id` is checked against `auth.uid()` for SELECT, INSERT, UPDATE and DELETE. Comments have their own RLS policies and a **composite foreign key `(task_id, user_id)`** that prevents attaching comments to another user's tasks. Only public Supabase credentials are used in the browser.

To test isolation: open the deployed app in a normal window and a private/incognito window. Each should create a separate anonymous user. Create a task in one window and confirm it is invisible in the other. Refresh and confirm persistence. For more thorough testing, inspect RLS policies in Supabase and attempt cross-user access with separate authenticated clients.

## Architecture
- `src/App.tsx`: board UI, CRUD, comments, drag-and-drop, filtering, stats and session bootstrapping
- `src/lib/supabase.ts`: public-key Supabase client
- `src/lib/types.ts`: domain types and column metadata
- `src/styles.css`: responsive design system
- `supabase/schema.sql`: database schema and security policies

## Trade-offs and future improvements
- Anonymous sessions are browser-local: clearing storage loses access to the original anonymous account. An optional account upgrade/identity linking flow would solve this.
- Drag positions use fractional ordering for quick client updates. For a high-traffic collaborative board, use transactional server-side rebalancing and conflict handling.
- Task updates use optimistic state with rollback on failure, but there is no cross-device realtime subscription. Supabase Realtime could synchronize multiple tabs/devices.
- This is a personal workspace, not multi-user collaboration. Team members, assignment permissions, audit logs and labels would require additional tables and authorization rules.
- Add automated unit, integration and end-to-end tests for production use.

## Assessment confidentiality
Do not commit or publicly post the original assessment PDF. Do not post the final submission document/link on public social media or profile pages. A source repository may be public or private according to the assessment instructions.
