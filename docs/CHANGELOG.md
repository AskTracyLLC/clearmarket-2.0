# ClearMarket Changelog

## 2026-01-16 — Vendor Do Not Use List
- **DB Migration**: Added `vendor_do_not_use_reps` table for vendor-scoped DNU list
  - Columns: `id`, `vendor_id`, `rep_user_id`, `full_name`, `primary_email`, `emails[]`, `aliases[]`, `reason`, `notes`, `created_at`, `created_by`
  - Partial unique index on `(vendor_id, rep_user_id)` where `rep_user_id IS NOT NULL`
  - RLS: vendor members SELECT, vendor admin/owner INSERT/UPDATE/DELETE
- **VendorMyReps.tsx**: Added 3rd tab "Do Not Use" with count badge
- **VendorDoNotUseReps.tsx**: New component listing DNU entries with Reason column, expandable Notes, multi-email display (Primary/Alt labels)
- **MarkDoNotUseDialog.tsx**: New dialog for marking connected reps as DNU (upsert on unique constraint)
- **MyRepsTable.tsx**: Added "Mark Do Not Use" action in row dropdown menu
- Connected Reps are now filtered to exclude reps in the DNU list
- Separate from Offline Rep Contacts (no schema changes to that table)

## 2026-01-16 — Admin Credits Refresh Fix + Admin RLS for Vendor Wallet
- **DB Migration**: Added admin-only SELECT RLS policies for `vendor_wallet` and `vendor_wallet_transactions`
- Admins can now read any vendor's wallet balance and transaction history
- Refresh button now correctly reloads balance from `vendor_wallet` with proper error handling
- Existing vendor-member policies remain intact (unchanged)
- Credit System Rule preserved: vendor credits in `vendor_wallet`, rep credits in `user_wallet` (never mixed)

## 2026-01-16 — Admin Credits Vendor Code Search
- **AdminCredits.tsx**: Added `vendor_public_code` to search query (matches "MBFS"-style codes)
- Search now matches: company name, Vendor Code, Vendor # (anonymous_id), or owner email
- Updated placeholder and helper text to reflect new search capability
- Added Vendor Code badge in search results and selected vendor panel
- No changes to wallet logic (vendor_wallet remains canonical for vendors)

Newest entries at top.

## 2026-01-16

- **Admin Credits Vendor Wallet Reconciliation** — AdminCredits page now reads/writes vendor credits from `vendor_wallet` + `vendor_wallet_transactions`

  - **DB:** none (code-only, edge function already used vendor_wallet)

  - **Routes:** `/admin/credits`

  - **Files:** `AdminCredits.tsx`, `FEATURE_MAP.md`, `CHANGELOG.md`

  - **Notes:** Separated vendor/rep credit systems. Vendor search by company name, anonymous ID, or owner email. Transactions display from `vendor_wallet_transactions`. Credit System Rule documented: vendor credits in vendor_wallet, rep credits in user_wallet—never mixed.

- **Feature Map Reconciliation** — Migrated credit flows from legacy `user_wallet` to shared `vendor_wallet`

  - **DB:** none (code-only migration)

  - **Routes:** none

  - **Files:** `SeekingCoverageDialog.tsx`, `usePaidFeature.tsx`, `Dashboard.tsx`, `FEATURE_MAP.md`

  - **Notes:** Corrected FEATURE_MAP.md to reflect actual tables: `vendor_wallet`, `vendor_wallet_transactions`, `vendor_staff_notes`, `vendor_rep_notes`, `user_ui_preferences`. Legacy `user_wallet` references removed from vendor flows.



- **Vendor Staff/Rep Notes System** — Internal notes for vendor teams with public/private visibility

  - **DB:** `20260116003102_b80213d8-064a-4e92-a066-675c9603e828`

  - **Files:** `VendorStaffNotesDrawer.tsx`, `VendorRepNotesDrawer.tsx`, `VendorStaff.tsx`, `VendorMyReps.tsx`, `MyRepsTable.tsx`

- **Pinned Sidebar Persistence** — User UI preferences now persist to database

  - **DB:** `20260116003102_b80213d8-064a-4e92-a066-675c9603e828` (user_ui_preferences table)

  - **Files:** `usePinnedFeatures.ts`, `LeftSidebar.tsx`

- **Do Not Use List** — "Do Not Use" list integrated as third tab on My Reps page

  - **DB:** `20260116030923_5175f074-9a02-4bde-b985-68ec1cf8cb6c` (vendor_do_not_use_reps table)

  - **Routes:** `/vendor/my-reps` (tab: donotuse)

  - **Files:** `VendorDoNotUseReps.tsx`, `MarkDoNotUseDialog.tsx`, `VendorMyReps.tsx`
