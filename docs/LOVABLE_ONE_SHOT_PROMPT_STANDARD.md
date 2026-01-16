# ClearMarket — Lovable One-Shot Prompt Standard (No Check-ins)

Standards for AI-assisted development on this project.

---

## Core Rules

### No Check-ins
- Do not ask clarifying questions mid-task. If ambiguity exists, make a reasonable decision and document it in the Completion Report.
- Execute the full scope in one pass.

### Wiring Rule
- No partials: If you create a new component, drawer, or page, wire it into the UI entry point in the same pass or remove it.
- Every new feature must be fully functional and accessible from the UI before marking complete.

---

## Completion Report Requirements

When you finish a feature and write a Completion Report, also append a short entry to `/docs/CHANGELOG.md` in the same pass/commit.

### Changelog Entry Format

```
## YYYY-MM-DD

- **<Feature Name>** — <1-line summary>

  - **DB:** <migration id(s) or "none">

  - **Routes:** <route list or "none">

  - **Files:** <key files, max 8, truncate with "+N more">
```

### Changelog Rules
- Newest entries go at the top.
- Keep file lists to max 8 entries; use "+N more" for overflow.
- Every Completion Report MUST include a changelog append in the same commit.

---

## Other Standards

### Database Migrations
- Use `DROP TRIGGER IF EXISTS` before creating triggers (idempotent pattern)
- Use existing helper functions (`has_vendor_access_by_profile`, `has_vendor_access_by_owner`) for RLS
- Enable RLS on all new tables

### UI Patterns
- Use existing shadcn/ui components
- Follow existing drawer/modal patterns for consistency
- Match action menu styles (icons, separators, ordering)
