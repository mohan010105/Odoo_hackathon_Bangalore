# DAYFLOW HRMS

Dayflow is a role-based HR management system covering employee records, attendance,
leave, payroll and payslips, with a secure server-side Odoo integration layer.

## 1. Project Overview

Dayflow gives HR teams a single view of their workforce and gives employees
self-service access to their own records. Administrators provision employees,
correct attendance, approve leave, generate payroll and monitor Odoo
synchronisation. Employees check in and out, request leave, track balances and
open their payslips.

## 2. Problem Statement

HR operations often involve disconnected workflows for employee records,
attendance, leave, payroll and reporting. Data is re-entered between tools,
approvals happen over chat and email, and payroll depends on spreadsheets that
nobody can audit.

## 3. Solution

Dayflow provides a unified HR workflow connecting employee management,
attendance, leave, payroll, payslips, activity logging and Odoo integration —
with every sensitive operation executed server-side and recorded.

## 4. Key Features

**Employee Management**
- Admin-only provisioning with generated login IDs and first-login password change
- Employee directory with search and multi-criteria filters
- Employee profile with editable details and profile picture
- Profile completion indicator

**Attendance**
- Check-in / check-out with a live session timer
- Server-calculated work hours against an 8-hour standard, plus extra hours
- Attendance history for employees, organisation-wide view for admins
- Admin correction with a notification to the employee
- CSV export

**Leave Management**
- Leave types, annual quotas and per-employee allocations
- Requests with inclusive calendar-day counting and mandatory attachments where required
- Admin approval queue with approve / reject and comments
- Leave balance cards and a month-view leave calendar
- CSV export with filters

**Payroll**
- Salary components (earnings and deductions, fixed or percentage)
- Per-employee salary structures
- Server-side payroll preview with exceptions, then confirmed generation
- Register with generated / processed / paid transitions
- CSV exports and batch payslip download (ZIP), idempotent per export

**Payslips**
- Printable payslip with earnings, deductions, attendance and leave summary
- Employee payslip history, deep-linked from payroll notifications

**Notifications**
- In-app notifications for attendance corrections, leave decisions and payroll readiness
- Category filters with per-category unread counts
- Unread-first paginated history with "load more" and mark-all-as-read

**Odoo Integration**
- Connection test with truthful CONNECTED / DISCONNECTED / NOT CONFIGURED states
- Integration dashboard: last successful sync, last attempt, per-module statistics
- Bulk employee sync with progress, dry-run preview, and a safe cancel
- Sync activity log with filters and CSV export, plus per-record retry

**Role-Based Access, Security, Reporting**
- Admin activity log with filters, sorting, pagination and idempotent CSV export
- Row Level Security on every table, admin checks enforced server-side
- Session idle timeout and password strength rules

## 5. User Roles

**ADMIN** — manage employees, view organisation attendance, approve or reject
leave, manage payroll and salary structures, view the activity log, manage the
Odoo integration and review synchronisation history.

**EMPLOYEE** — view and edit own profile, check in and out, view own
attendance, request leave, view leave balance, view own payroll and payslips,
receive notifications.

Employees cannot reach administrative routes or data: route guards handle the
UI, and server-side role checks plus Row Level Security enforce the boundary.

## 6. Architecture

```text
USER
 ↓
DAYFLOW FRONTEND (React + TanStack Start)
 ↓
AUTHENTICATION (email / password, roles)
 ↓
SUPABASE-BACKED CLOUD
 ├── PostgreSQL (schema, RLS, SQL business logic)
 ├── Storage (avatars, leave attachments)
 └── Realtime (attendance and notification updates)
 ↓
SECURE INTEGRATION LAYER (server functions, credentials never in the browser)
 ↓
ODOO
```

Dayflow handles the employee-facing HR workflow. Odoo provides enterprise
integration. The architecture is deliberately one-directional at the boundary:
if Odoo becomes temporarily unavailable, Dayflow keeps operating and
synchronisation records move to PENDING or FAILED with retry available.

## 7. Technology Stack

- React 19 with TanStack Start (SSR) and TanStack Router
- TanStack Query for data fetching and cache
- TypeScript, Vite, Tailwind CSS v4, shadcn/ui components
- Zod validation on every server function input
- Server functions (`createServerFn`) for all privileged logic
- PostgreSQL with SQL `SECURITY DEFINER` functions for attendance, leave and payroll math

## 8. Backend Architecture

- Authentication with email verification and leaked-password protection
- `profiles` and a separate `user_roles` table (roles are never stored on profiles)
- `has_role` / `is_admin` security-definer helpers used by policies
- Business rules implemented in SQL so a client cannot fabricate hours, balances or salary totals
- Private storage buckets with signed URLs for leave attachments
- Realtime channels for attendance and notification updates

## 9. Odoo Integration

- Credentials live only in server environment variables and are read inside handlers
- All Odoo calls run through an admin-gated server layer; the browser never holds credentials
- `odoo_mappings` links Dayflow records to Odoo IDs, making re-runs idempotent (update instead of duplicate)
- `odoo_sync_logs` records each operation with a safe, summarised message — no stack traces, no provider internals
- Failures are categorised and retryable per record or per module
- Bulk employee sync supports a dry run that writes nothing, plus cancellation with a final recorded status

## 10. Database Overview

| Area | Tables |
| --- | --- |
| Identity | `profiles`, `user_roles`, `companies` |
| Employees | `employees`, `employee_login_sequences` |
| Attendance | `attendance` |
| Leave | `leave_types`, `leave_allocations`, `leave_requests` |
| Payroll | `salary_components`, `salary_structures`, `salary_structure_components`, `payroll_records` |
| Platform | `notifications`, `audit_logs`, `export_jobs` |
| Integration | `odoo_mappings`, `odoo_sync_logs` |

Every table has Row Level Security enabled with explicit grants. Employees can
read only their own attendance, leave, salary and payroll rows; administrators
are authorised through `is_admin()`.

## 11. Security

- Row Level Security on all tables; no permissive catch-all policies
- Roles in a dedicated table, checked through a security-definer function
- Server-side admin assertions on every privileged server function
- Attendance timestamps, leave balances and payroll totals are computed in SQL
- Password strength rules, first-login password change, idle session timeout
- Activity log for sensitive actions; credentials and tokens are never recorded
- Export claims by idempotency key so duplicate clicks cannot duplicate records
- No secrets in client code, `localStorage`, `sessionStorage`, public files or logs

## 12. Installation

Requires Node.js 20 or newer.

```sh
git clone <this-repository-url>
cd <repository-name>
npm install
```

## 13. Environment Setup

Copy the template and fill in your own values:

```sh
cp .env.example .env
```

Client (browser-safe, injected into the bundle):

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
```

Server-only (never prefix with `VITE_`):

```text
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ODOO_BASE_URL=
ODOO_DATABASE=
ODOO_USERNAME=
ODOO_API_KEY=
```

`ODOO_PASSWORD` is accepted as an alias for `ODOO_API_KEY`. When the Odoo
variables are absent, the integration reports NOT CONFIGURED and the rest of
the application continues to work normally. `.env` is git-ignored; only
`.env.example` (placeholders) is tracked.

## 14. Running Locally

```sh
npm run dev      # development server (Vite)
npm run build    # production build → dist/
npm run preview  # serves the production build from dist/
```

`npm run dev` prints the local URL. Sign in with an existing account, or create
the first administrator through the `/setup` route.

## 15. Backend Setup

The app talks to a Supabase (PostgreSQL) project. To point it at your own:

1. Create a project and run every file in `supabase/migrations/` in filename
   order — they create the tables, RLS policies, grants, SQL functions and
   triggers the app relies on.
2. Create the private storage buckets `profile-pictures`,
   `employee-documents`, `leave-attachments` and `company-logos`.
3. Put the project URL, publishable key and project id in `.env`.

There are no Supabase Edge Functions in this project. All privileged logic runs
as TanStack Start server functions (`src/lib/*.functions.ts` with
`src/lib/**/*.server.ts` helpers) plus SQL `SECURITY DEFINER` functions, and
external/cron callers use server routes under `src/routes/api/`. Server-only
secrets (service role key, Odoo credentials) are read with `process.env` inside
handlers and never reach the browser.

## 16. Deployment

This is a server-rendered React app (TanStack Start), not a static SPA, so it
needs a Node-capable host or an adapter — no rewrite/`_redirects` file is
required for client-side routing.

```sh
npm run build     # → dist/client (assets) + dist/server/index.mjs (server)
npm run preview   # node dist/server/index.mjs
```

Deploy with `npm start`-style hosting by running `node dist/server/index.mjs`
behind your process manager, or target a platform adapter by setting
`NITRO_PRESET` at build time, e.g.:

```sh
NITRO_PRESET=vercel npm run build
NITRO_PRESET=netlify npm run build
NITRO_PRESET=cloudflare-module npm run build
```

Configure the same environment variables in the hosting dashboard. Client
variables must be present at build time; server variables at runtime.

## 17. Demo Workflow

1. Login
2. Admin dashboard — one view of the workforce
3. Employee directory → open an employee
4. Employee profile
5. Attendance — check-in / check-out and history
6. Leave — employee requests leave
7. Admin approves the request
8. Payroll — preview and generate
9. Payslip — open the generated payslip
10. Odoo — connection state and synchronisation history
11. Activity log — who did what, and when

Employee path: login → dashboard → check in → attendance → request leave →
leave status → payslip → notifications → logout.

## 18. Future Enhancements

- Shift and roster planning
- Bi-directional Odoo synchronisation
- Performance reviews and goals
- Document management with expiry reminders
- Multi-currency and multi-country payroll rules

---

**Problem** — HR operations often involve disconnected workflows for employee
records, attendance, leave, payroll and reporting.

**Solution** — Dayflow provides a unified HR workflow connecting employee
management, attendance, leave, payroll, payslips, analytics and Odoo
integration.

**Differentiator** — Dayflow combines an intuitive employee experience with
secure enterprise integration and resilient synchronisation.
