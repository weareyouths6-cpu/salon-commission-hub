# Salon Commission Management Module

An **admin-only** module that reads from your existing salon database (invoices, stylists, assistants, services, products, packages) and automatically calculates, stores, and reports commissions. It does **not** duplicate your invoice system.

## Database connection

You mentioned reusing the same `.env` from your local project. This Lovable app runs on Cloudflare Workers, so it needs a **network-reachable** Postgres/Supabase — a `localhost` DB won't work in production. Options:

- **Recommended:** Enable Lovable Cloud (Supabase) here, then either (a) point env vars at your existing hosted Supabase project, or (b) run your existing schema migrations here so both environments share structure.
- If your local DB is only reachable via tunnel, that works in preview only.

I'll build against the shared schema described below. If your column/table names differ, we'll rename in one pass after you share the actual schema (or a `pg_dump --schema-only`).

## Assumed existing tables (read-only for this module)

```text
invoices(id, invoice_no, invoice_date, customer_id, stylist_id, assistant_id, total, payment_status)
invoice_items(id, invoice_id, item_type, item_id, name, quantity, unit_price, line_total)
  -- item_type ∈ ('service','product','package','ginseng_box','freedom')
customers(id, name, phone)
stylists(id, name)
assistants(id, name)   -- aka staff
```

If your schema stores category on `services/products/packages` instead of on `invoice_items`, we'll add a lightweight `v_invoice_items_categorized` SQL view to normalize it into the five categories.

## New tables (created by this module)

```sql
commission_settings(
  id, category text unique,       -- service|product|package|ginseng_box|freedom
  stylist_percent numeric(6,3),
  staff_percent numeric(6,3),
  updated_by uuid, updated_at timestamptz, created_at timestamptz)

commission_records(               -- immutable ledger
  id, invoice_id, invoice_item_id,
  employee_id, employee_role,      -- 'stylist' | 'assistant'
  category, sale_amount,
  commission_percent, commission_amount,
  invoice_date, created_at)

payrolls(
  id, employee_id, employee_role, month, year,
  total_commission, bonus, deduction, net_pay,
  payment_status, payment_date, remarks, created_at,
  unique(employee_id, employee_role, month, year))

commission_audit_log(
  id, actor_id, action, category, old_stylist_percent, old_staff_percent,
  new_stylist_percent, new_staff_percent, notes, created_at)

user_roles(id, user_id, role)     -- role enum: admin, manager, accountant, staff
```

All new `public` tables get explicit `GRANT`s + RLS with `has_role(auth.uid(),'admin')` policies. Percentages seeded with your defaults (Service 7/3, Product 3.75/3.75, Package 2.5/2.5, Ginseng 5/5, Freedom 5/5).

## Commission engine

- Server function `syncCommissionsForInvoice(invoiceId)` iterates each invoice item, looks up **current** `commission_settings` by category, computes `sale_amount * percent / 100` for stylist and assistant, and **inserts** rows into `commission_records`. Idempotent per `(invoice_item_id, employee_role)` — safe to re-run.
- Server function `syncCommissionsSince(date)` batch-processes any invoices missing records. Runs on demand and on a nightly cron (`/api/public/cron/sync-commissions` with HMAC secret).
- **Historical immutability:** editing a percentage never rewrites past `commission_records`. The Recalculation Tool (below) is the only way to overwrite, and it always writes an audit log entry.

## Admin user & auth

- Lovable Cloud email/password auth.
- Migration seeds admin account `admin@salon.com` / `SalonAdmin!2026` and assigns `admin` role via `user_roles`. Password can be changed from the profile page.
- Route tree: everything meaningful lives under `/_authenticated/` and additionally checks `has_role('admin')` in `beforeLoad`. Non-admins see an "Access denied" screen.
- Role table designed so `manager`/`accountant` can be added later without refactor.

## Pages

1. **Dashboard** (`/`) — KPI cards: Today's Sales, Today's Commission, Monthly Commission, Total Staff, Total Stylists, Pending Payment. Charts: monthly sales, monthly commission, top stylist, top assistant, commission trend.
2. **Commissions** (`/commissions`) — full ledger table with columns from your spec, filters (invoice, customer, stylist, assistant, date, month, year), sortable columns, pagination, row → invoice drill-down modal.
3. **Stylists** (`/stylists`) — summary cards per stylist (Today, This Month, Last Month, Total Sales, Invoice count). Click → `/stylists/$id` detail with filterable table + running total.
4. **Assistants** (`/assistants`) — same layout as stylists.
5. **Payroll** (`/payroll`) — pick month/year → **Generate Payroll** aggregates `commission_records` into `payrolls`. Edit bonus/deduction/remarks inline, Mark as Paid action, status filter.
6. **Settings** (`/settings/commission`) — editable table of percentages with Save + Reset Defaults; each save writes to `commission_audit_log`.
7. **Reports** (`/reports`) — daily/weekly/monthly/yearly generators, export to CSV / Excel (`xlsx`) / PDF (`jspdf` + `jspdf-autotable`), same chart set as dashboard.
8. **Recalculation Tool** (`/settings/recalculate`) — pick date range → preview affected rows → confirm → overwrite, all logged.
9. **Audit Log** (`/settings/audit`) — read-only view of `commission_audit_log`.
10. **Notifications** — badge in top nav for unpaid current-month payrolls and any invoice missing commission records.

## UI

Clean white ERP/POS style with a blue accent (`#2563EB`/primary). shadcn/ui + Tailwind, `@tanstack/react-table` for tables, `recharts` for charts, `date-fns` for date handling. Responsive from mobile up.

## Technical notes

- TanStack Start server functions with `requireSupabaseAuth` + role check for every write.
- Public cron endpoint under `/api/public/cron/*` with HMAC-verified secret.
- All money as `numeric`, formatted in the UI with locale (MMK).
- No changes to your existing invoice tables — this module only reads them and writes to its own tables.

## Open items I'll confirm before/while building

1. Actual schema of your existing tables (names/columns) — if it differs from the assumed shape above, share it and I'll adjust the reader/view in one edit.
2. Whether to point at your existing hosted Supabase or run your schema fresh in Lovable Cloud here.

Ready to switch to build mode once you confirm.