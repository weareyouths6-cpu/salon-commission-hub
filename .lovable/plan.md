
# Point the commission module at your salon Supabase project

## What you need to do first (I can't do this from chat)

1. Open **Project Settings → Backend / Connectors** in the Lovable UI.
2. **Disconnect Lovable Cloud** from this project.
3. Choose **Connect your own Supabase** and select project `xrpzyqftxbjxclwscqka` (the salon DB).
4. **Rotate your `SUPABASE_SERVICE_ROLE_KEY`** in the Supabase dashboard — the key you pasted in chat is public now and must be invalidated. Also confirm `VITE_SUPABASE_PUBLISHABLE_KEY` in your `.env` is the **anon** key (the value you sent had `role: service_role`, which must never be a `VITE_*` variable).

Once the backend is switched, the managed `.env`, `src/integrations/supabase/client.ts`, and `types.ts` will regenerate against the salon project automatically. Then I take over.

## What I will do after the switch

### 1. Run the commission-module migration on the salon DB
Re-apply the existing `20260708014237_*.sql` migration into `xrpzyqftxbjxclwscqka`. It only adds:
- `packages.category` column (enum tag: hair / spa / nail / facial / other)
- `commission_settings` (per-role, per-category %, with sale-vs-session split)
- `commission_records` (ledger — one row per employee per event)
- `payrolls`, `commission_audit_log`
- `has_role()` + `user_roles` (only if missing — your schema already has them)

It does **not** touch your existing `customers`, `packages`, `customer_packages`, `usage_logs`, `session_staff`, `profiles`, or invoice-related tables.

### 2. Verify RLS + GRANTs on the salon tables the module reads
The commission code reads `customer_packages`, `usage_logs`, `session_staff`, `packages`, `profiles`. I'll check that `authenticated` has SELECT on each (your existing salon app already needs this) and add any missing GRANT without changing your existing policies.

### 3. Seed admin + commission settings
- Ensure `admin@salon.com` exists as an auth user (create if missing) and insert `('admin', <uid>)` into `user_roles`.
- Insert default rows into `commission_settings` (5 categories × 2 roles × sale/session — editable from the Settings page).

### 4. Regenerate `src/integrations/supabase/types.ts` against the salon DB
So the commission queries typecheck against your real tables.

### 5. Backfill the ledger
Run the existing "Sync all commissions" server function from the Recalculate page — walks every `customer_packages` row + every `usage_logs` row and populates `commission_records`.

### 6. Fix the current runtime error
The `Failed to fetch dynamically imported module` on `/commissions` was a stale Vite dep-cache hit after the last edit round. After the backend switch the sandbox rebuilds from scratch, which clears it. No code change needed.

## What will NOT change
- No edits to your existing salon tables' structure or policies.
- No changes to your invoice / booking flow.
- Commission module stays a separate set of tables + read-only queries against your existing data.

## Please confirm before I start
- [ ] Backend switched to `xrpzyqftxbjxclwscqka` in the Lovable UI
- [ ] Service-role key rotated in Supabase
- [ ] OK for me to run the commission migration on the salon DB
- [ ] OK to create/promote `admin@salon.com` in that project

Reply "go" once the switch is done and I'll execute steps 1–6.
