# ClearMarket Changelog

Newest entries at top.

## 2026-01-16

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
