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

### Database / RLS
- Use existing helper functions for RLS:
  - `has_vendor_access_by_profile` for tables keyed by `vendor_profile.id`
  - `has_vendor_access_by_owner` for tables keyed by `profiles.id` (vendor owner profile)
- Enable RLS on all new tables.
- Idempotent migrations:
  - `DROP TRIGGER IF EXISTS` before creating triggers
  - `DROP POLICY IF EXISTS` before creating policies
  - Use `IF NOT EXISTS` where safe

### Security / Credits (when applicable)
- Wallet balances must not be directly mutable by client-side UPDATEs.
- Any “add credits” function should be service-role only; “spend” must enforce permissions server-side.

### UI Patterns
- Use existing shadcn/ui components and existing drawer/modal patterns.
- Match existing action menu styles (icons, separators, ordering).
- Do not invent new UX patterns if an existing one exists.

---

