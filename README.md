# Pretty Chic Aesthetics Clinic Portal

A luxury-minimalist clinic management portal for an aesthetic clinic.
Built with **Next.js 14 (App Router) + Supabase + Tailwind CSS**, deploy-ready for Vercel.

## Features

- Supabase Auth login for **Owner/Admin** and **Staff** with role-based permissions
- **Dashboard** with stat cards: Total Clients, Today's Appointments, Total Sessions, Monthly Expenses, Receivable, Low Stock, Monthly Revenue, Recent Activity
- **Clients** module: full CRUD, search, profile, treatment & payment history
- **Appointments** module: list + calendar views, inline status updates, admin-only delete
- **Sessions** module: linked to clients; marking a session "Completed" automatically deducts one remaining session
- **Expenses** module: CRUD with category filtering and paid status tracking
- **Meds & Kits Inventory**: add/consume stock with quantity modal, automatic Low Stock / Out of Stock badges, per-item logs
- **Payments**: record payments, optionally subtract from client outstanding balance
- **Reports** + **Activity Logs**: monthly summary cards and a full audit trail
- **Settings**: clinic name, **logo upload (Supabase Storage)** with live preview, theme color, sidebar color, low-stock default, and full employee management (create / disable / change role) via service-role admin API
- **Loading screen** with clinic logo and "Loading clinic portal..." text
- Mobile-responsive layout with bottom tab bar
- Row Level Security on every table

---

## 1. Setup Supabase

1. Create a new project at https://supabase.com.
2. From the project dashboard, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** (Settings → API → Project API keys) → `SUPABASE_SERVICE_ROLE_KEY`
3. Open the **SQL Editor**, paste the contents of [`supabase/schema.sql`](./supabase/schema.sql), and run it.
   This creates every table, RLS policy, triggers (auto profile creation, stock status), and the `clinic-assets` storage bucket.
4. Create the **first admin/owner**:
   - In Supabase **Authentication → Users → Add user**, enter an email and password.
   - In **SQL Editor**, run:
     ```sql
     update public.profiles set role = 'admin', full_name = 'Owner' where email = 'owner@example.com';
     ```
   - All future staff accounts can be created from inside the app at **Settings → Manage Employees**.

---

## 2. Local development

```bash
cp .env.example .env.local
# edit .env.local with your Supabase keys
npm install
npm run dev
```

Open http://localhost:3000 and sign in with the owner account you created above.

---

## 3. Deploy to Vercel

1. Push the project to a GitHub repository.
2. Go to https://vercel.com → **New Project** → import the repo.
3. Add the **Environment Variables** (Production + Preview + Development):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` *(server-side only — used for admin employee management)*
4. Click **Deploy**. Vercel auto-detects Next.js and builds with `npm run build`.
5. After the first deploy, sign in with the owner account.

> ℹ️ The service-role key is **never** exposed to the browser — it's only read inside server-only routes (`src/app/api/employees/route.ts`).

---

## 4. Project structure

```
src/
  app/
    (portal)/                # authenticated layout (sidebar + content)
      dashboard/             # stat cards + recent activity
      clients/               # list, new, [id], [id]/edit
      appointments/
      sessions/
      expenses/
      inventory/             # meds & kits
      payments/
      reports/               # summary + /reports/logs
      settings/              # branding + employee management
    api/
      auth/signout/route.ts
      employees/route.ts     # service-role admin endpoint
    login/                   # public login page
    loading.tsx              # global loading screen with logo + spinner
    layout.tsx               # injects theme colors from settings
  components/                # Sidebar, Logo, StatCard, PageHeader, LoadingScreen, ...
  lib/
    supabase/                # browser, server (cookies), admin clients
    auth.ts                  # getCurrentProfile, requireAdmin
    settings.ts              # cached settings fetch
    activity.ts              # server-side activity log helper
    types.ts                 # shared TS types
supabase/
  schema.sql                 # full DB schema + RLS + storage bucket
```

---

## 5. Roles & permissions

| Capability                          | Admin / Owner | Staff |
|-------------------------------------|:-------------:|:-----:|
| View dashboard                       | yes           | yes   |
| Add / edit clients, appointments, sessions, expenses, inventory, payments | yes | yes |
| Consume / add inventory stock        | yes           | yes   |
| **Delete** clients, appointments, expenses, inventory, sessions | yes | **no** |
| Manage employees (create / disable / change role)   | yes | no |
| Change clinic branding (logo, colors, name)         | yes | no |
| View activity logs                                   | yes | yes |

Permissions are enforced at two layers:

1. **UI**: Delete and admin-only buttons are hidden / disabled for staff.
2. **Database (RLS)**: Every table has policies that allow `select`, `insert`, `update` to any active user but restrict `delete` to admins via the `is_admin()` helper function. The `settings` table allows reads for everyone but writes only for admins.

---

## 6. Activity logs

Every important user action is automatically written to `activity_logs` with:

- actor id + actor name (resolved from profile)
- action text (e.g. "added new client Maria Santos", "consumed 2ml Diamond Pro")
- entity + entity id (so logs can be filtered to a single client)
- timestamp

You can view the full audit trail at **Reports → Activity Logs** (`/reports/logs`).

---

## 7. Logo & branding

- Upload a logo from **Settings → Clinic Branding**. It's stored in the public `clinic-assets` Supabase Storage bucket.
- The uploaded logo appears on:
  - Login page (centered, above the form)
  - Dashboard (in the header / mobile center)
  - Sidebar (top-left)
  - Loading screen (centered with spinner)
- Theme color and sidebar color are applied at runtime via CSS variables in `src/app/layout.tsx`.

---

## 8. Tech stack

- Next.js 14 (App Router, Server Components)
- TypeScript
- Tailwind CSS
- Supabase: Auth, Postgres, Storage, Row Level Security
- `@supabase/ssr` for cookie-based session handling
- `lucide-react` icons
- `date-fns` for formatting (optional helpers)

---

## 9. Useful commands

```bash
npm run dev        # start dev server
npm run build      # production build
npm run start      # serve the built app
npm run typecheck  # TypeScript only
npm run lint       # next lint
```
