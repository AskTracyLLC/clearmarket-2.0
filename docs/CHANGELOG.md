# ClearMarket Changelog

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

  - **Routes:** `/vendor/blocked-reps`

  - **Files:** `VendorStaffNotesDrawer.tsx`, `VendorRepNotesDrawer.tsx`, `VendorBlockedReps.tsx`, `VendorStaff.tsx`, `VendorMyReps.tsx`, `MyRepsTable.tsx`, `LeftSidebar.tsx`, `App.tsx`

- **Pinned Sidebar Persistence** — User UI preferences now persist to database

  - **DB:** `20260116003102_b80213d8-064a-4e92-a066-675c9603e828` (user_ui_preferences table)

  - **Routes:** none

  - **Files:** `usePinnedFeatures.ts`, `LeftSidebar.tsx`

- **Blocked Reps Page** — "Do Not Assign" list for vendor teams

  - **DB:** `20260116003102_b80213d8-064a-4e92-a066-675c9603e828` (extended vendor_offline_rep_contacts)

  - **Routes:** `/vendor/blocked-reps`

  - **Files:** `VendorBlockedReps.tsx`, `LeftSidebar.tsx`, `App.tsx`
