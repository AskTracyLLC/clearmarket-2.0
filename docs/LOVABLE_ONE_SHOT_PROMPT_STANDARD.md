# ClearMarket — Lovable One-Shot Prompt Standard (No Check-ins)

This document is the project’s source of truth for Lovable behavior and must be followed on every task. Standards for AI-assisted development on this project.

---

## Non-Negotiables

### 1) No Check-ins (Zero Back-and-Forth)
- Do **not** ask clarifying questions mid-task and do **not** “check in” for approval.
- If ambiguity exists, choose a **reasonable default**, implement it, and list it under **Assumptions/Defaults Chosen** in the Completion Report.
- Execute the full scope in **one pass**.

### 2) Wiring Rule (No Partials)
- If you create a new **component / drawer / page / hook**, you must **wire it into the existing UI entry point in the same pass**.
- If you cannot fully wire it, **remove it** (no orphan files) and explain in the Completion Report.
- Every new feature must be fully functional and accessible from the UI before marking complete.

### 3) Atomic Delivery
A feature is not “complete” unless all are true in the same pass/commit:
1) DB changes (if any) applied  
2) Edge functions updated/deployed (if any)  
3) UI wired and reachable from the app  
4) Basic role/RLS expectations verified  

---

## Completion Report Requirements (MANDATORY)

Every Completion Report MUST include:

- **Summary** (1–3 bullets)
- **Files changed** (bulleted list)
- **DB migrations** (id(s) or “none”)
- **Routes** (list or “none”)
- **Tested scenarios** (3–8 bullets)
- **Assumptions/Defaults Chosen** (required if any ambiguity existed)
- **Known limitations** (only if unavoidable)

---

## Changelog Rule (MANDATORY)

After every feature completion, also append an entry to `/docs/CHANGELOG.md` in the same pass/commit.

**Rules**
- Newest entries go at the top.
- Keep file lists to max 8 entries; use “+N more” for overflow.

**Entry format**
## YYYY-MM-DD

- **<Feature Name>** — <1-line summary>
  - **DB:** <migration id(s) or "none">
  - **Routes:** <route list or "none">
  - **Files:** <key files, max 8, truncate with "+N more">

---

## Feature Map Rule (MANDATORY)

After every feature completion, also update `/docs/FEATURE_MAP.md` in the same pass/commit.

- Add new routes to **Section 1 (UI Routes)**
- Add new DB/edge/RPC objects to **Section 2 (Backend Objects)**
- Update **Section 3 (Crosswalk UI ↔ Backend)** for anything touched

---

## Engineering Standards

### Schema Verification (Required) — NO GUESSING  ✅ (NEW TERM)
Before writing ANY migration, RLS policy, trigger, function, or query that references existing tables/columns, you MUST verify the actual schema in the current database and use the exact column names that exist.

**Why this is mandatory:** Small naming differences (example: `vendor_staff.staff_user_id` vs `vendor_staff.user_id`, or whether `profiles.user_id` exists) cause hard failures and rework. This section prevents back-and-forth.

#### Required Preflight Checks (run first)
Run these queries (or equivalent schema inspection) and use the results as the source of truth:

1) Confirm `profiles` columns (especially ownership identifiers)
```sql
select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='profiles'
order by ordinal_position;
Confirm vendor_staff columns (especially staff identifier + role/status)

sql
Copy code
select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='vendor_staff'
order by ordinal_position;
Confirm every table you will touch or reference in RLS

sql
Copy code
-- Replace <table_name> with each table you will modify or reference
select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='<table_name>'
order by ordinal_position;
Confirm whether helper functions exist (only if you plan to use them)

sql
Copy code
select n.nspname as schema, p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
  and p.proname in (
    'has_vendor_access_by_profile',
    'has_vendor_access_by_owner',
    'is_platform_admin'
  )
order by p.proname;
Rules
DO NOT assume columns like profiles.user_id or vendor_staff.user_id. Use verified names only.

If a referenced column does not exist, adapt the SQL to the actual schema (no “close guesses”).

If you truly need new DB objects, label them explicitly as NEW and include them in the migration.

Migrations must be idempotent:

CREATE TABLE IF NOT EXISTS

ADD COLUMN guarded by information_schema.columns checks (or equivalent)

CREATE INDEX IF NOT EXISTS

DROP POLICY IF EXISTS before CREATE POLICY

Completion Report must include:

✅ “Schema Verified”

Which columns were used for:

profiles (ownership identifier pattern)

vendor_staff (staff identifier + role/status fields)

Database / RLS
Prefer existing helper functions for RLS when available:

has_vendor_access_by_profile for tables keyed by vendor_profile.id

has_vendor_access_by_owner for tables keyed by profiles.id (vendor owner profile)

IMPORTANT: You may only use these helpers if they exist (verify via Schema Verification step). Otherwise, write explicit EXISTS(...) checks using the verified columns.

Enable RLS on all new tables.

RLS policies must match the verified schema patterns:

If the project uses profiles.id = auth.uid(), use that pattern.

If staff linkage uses vendor_staff.staff_user_id, use that pattern.

Idempotent migrations:

DROP TRIGGER IF EXISTS before creating triggers

DROP POLICY IF EXISTS before creating policies

Use IF NOT EXISTS where safe

RLS Access Pattern (Standard)
To avoid inconsistent access logic across features:

Define the access rules explicitly in the prompt (owner vs staff vs admin).

Apply the same access logic consistently to:

SELECT (who can view)

INSERT/UPDATE/DELETE (who can modify)

If “all staff can view,” write SELECT policy accordingly.

If only admin/owner can modify, enforce that on INSERT/UPDATE/DELETE.

For UPDATE policies, include both USING and WITH CHECK unless there is a verified reason not to.

Security / Credits (when applicable)
Wallet balances must not be directly mutable by client-side UPDATEs.

Any “add credits” function should be service-role only; “spend” must enforce permissions server-side.

UI Patterns
Use existing shadcn/ui components and existing drawer/modal patterns.

Match existing action menu styles (icons, separators, ordering).

Do not invent new UX patterns if an existing one exists.
