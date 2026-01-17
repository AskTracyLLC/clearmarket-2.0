# ClearMarket Changelog

## 2026-01-17 — Rep Credits Page + Navigation Fix
- **RepCredits.tsx**: New dedicated Rep Credits page at `/rep/credits`
  - Matches VendorCredits layout/styling
  - Shows credit balance, transaction history, boost status
  - Boost purchase/extend functionality
  - Links to Help Center article for boost details
- **TopNavRow.tsx**: Removed Credits from top nav for both vendors and reps (sidebar only)
- **LeftSidebar.tsx**: Added Credits to rep sidebar nav items
- **RepCreditsCard.tsx**: Updated to navigate to `/rep/credits` instead of opening dialogs
- **App.tsx**: Added `/rep/credits` route
- **Bug Fix**: Rep dashboard Credits click now routes to `/rep/credits` (was `/rep/availability`)

## 2026-01-17 — Field Rep Credits Visibility + Boost Visibility Feature
- **DB Migration**: Added rep visibility boost system
  - `rep_visibility_boosts` table: tracks rep boost purchases (starts_at, ends_at, credits_spent, status)
  - `rep_active_boost_status` view: returns current boost state per rep (is_boosted, ends_at)
  - `purchase_rep_boost()` RPC: atomic boost purchase/extend (2 credits for 48 hours)
  - RLS: reps can SELECT own boosts; no direct writes (SECURITY DEFINER only)
- **useRepCredits.ts**: New hook for rep credit balance + transaction history from `user_wallet`
- **useRepBoostStatus.ts**: New hook for boost status + purchase via RPC
- **RepCreditsCard.tsx**: Dashboard card showing credits, boost status, history + purchase dialogs
- **RepTransactionHistoryDialog.tsx**: Modal listing rep credit transactions
- **RepBoostPurchaseDialog.tsx**: Confirmation dialog for boost purchase/extend
- **VendorFindReps.tsx**: Boosted reps now sort first in search results
  - Sort: boosted first → ends_at DESC → starts_at DESC → Trust Score
- **Help Center**: Added "Boost Visibility (Field Reps)" article explaining ranking, multi-boost behavior, non-refundable policy

## 2026-01-17 — Share Profile Routing + Short URLs + Vendor Calendar Checklist Fix
- **RepShareProfilePage.tsx**: New authenticated page for reps to manage share links (`/rep/share-profile`)
- **ShortShareRedirect.tsx**: New redirect component for short share URLs (`/s/:slug`)
- **ProfileSharePanel.tsx**: 
  - Shortened slug generation (10-12 chars, base62 with crypto.getRandomValues)
  - Copy link now uses short URL format: `/s/:slug`
  - Preview still opens direct `/share/:role/:slug` path
- **App.tsx**: Added routes for `/rep/share-profile` and `/s/:slug`
- **checklistTracking.ts**: Fixed `vendor_calendar_updated` evaluation to check both `vendor_office_hours` and `vendor_calendar_events` tables
- **Bug Fix**: Vendor #9's calendar checklist item manually backfilled to complete status
- Short URL flow: `/s/:slug` → edge function resolves role → redirects to `/share/rep/:slug` or `/share/vendor/:slug`

## 2026-01-17 — Rep Milestone Reward (2 Credits) + Onboarding Fix
- **DB Migration**: Added rep milestone reward system
  - `rep_profile_pricing_status` view: checks profile details + coverage pricing (base_price only)
  - `rep_onboarding_status` view: fixed to use `vendor_alerts.rep_user_id` + `sent_at` for route alert check
  - `rep_alert_sent_status` view: helper for checklist sync
  - `award_rep_profile_pricing_credits()` RPC: awards 2 credits for milestone
  - `award_rep_onboarding_credits()` RPC: updated to award remaining credits (5 - already earned)
  - `get_rep_reward_summary()` RPC: returns full reward status for dashboard
  - RLS policies for `onboarding_rewards` and `user_wallet_transactions`
- **useRepRewardSummary.ts**: New hook for rep milestone + onboarding reward tracking
- **RepEarnCreditsCard.tsx**: New dashboard card showing:
  - ✅/⬜ "Complete profile & pricing" (2 credits)
  - ✅/⬜ "Finish required onboarding" (+3 more credits)
  - Next action links for incomplete items
- **Dashboard.tsx**: Added `RepEarnCreditsCard` prominently for reps
- **Bug Fix**: Route alert checklist item now uses `vendor_alerts` table (was using wrong table)
- Credits: Reps earn 2 for milestone, then 3 more (5 total) for full onboarding

## 2026-01-16 — Onboarding Completion Reward (5 Credits)
- **DB Migration**: Added `onboarding_rewards` table for idempotent reward tracking
  - `user_wallet_transactions` table for rep credit audit trail
  - `rep_onboarding_status` and `vendor_onboarding_status` views (REQUIRED items only)
  - `award_rep_onboarding_credits()` and `award_vendor_onboarding_credits(p_vendor_id)` RPCs
  - RLS policies for secure access
- **useOnboardingReward.ts**: New hook for checking status and auto-claiming rewards
- **GettingStartedChecklist.tsx**: Added reward banner showing pending/earned state
- **gettingStartedChecklistCopy.ts**: Added reward copy strings
- **Dashboard.tsx**: Enabled `showReward={true}` on primary checklist
- Credits awarded only when REQUIRED onboarding items complete; optional items never block
- Award is strictly one-time (idempotent) with full transaction audit trail

## 2026-01-16 — Help Center Routing Fix (Public + Demo + Signed-In)
- Help Center is now **fully public** under `/help/*` (no auth/layout guard)
- Deep links (e.g. `/help/:articleSlug` and `/help/:sectionSlug/:articleSlug`) no longer redirect to `/signin`
- Demo + signed-in users both link to the same public Help Center routes
- Back-compat: `/public-help` now redirects to `/help`

## 2026-01-16 — Unified Availability Calendar
- **UnifiedAvailabilityCalendar.tsx**: New component showing rep time off + all vendor network alerts in one calendar view
  - Displays: Time Off, Planned Routes, Planned Time Off Alerts, Availability Updates, Emergency alerts
  - Emergency alerts highlighted in red (chip + day number)
  - Day details panel shows entries when clicking a date
  - Filters for Show Time Off / Show Alerts
  - Max 2 chips per day cell with "+N more" overflow
- **RepAvailability.tsx**: Integrated unified calendar
  - New `loadAlertsForCalendar()` loader fetching all alert types from `vendor_alerts`
  - Calendar refreshes after any alert action (send/schedule/edit)
  - Click-to-edit from calendar day panel
- **No DB changes**: Uses existing `rep_availability` and `vendor_alerts` tables

## 2026-01-16 — Admin Systems Used Module + Layout Fix
- **DB Migration**: Added `platform_systems_used` table for admin-managed systems
  - Columns: `id`, `label`, `code` (unique), `description`, `is_active`, `sort_order`, `created_at`, `updated_at`
  - RLS: Authenticated users can SELECT; staff/admin can INSERT/UPDATE/DELETE
  - Seeds: EZInspections, InspectorADE, PPW, Form.com, WorldApp
- **AdminSystemsUsed.tsx**: New CRUD page at `/admin/systems-used`
  - Add, edit, activate/deactivate, delete systems
  - Gated via `useStaffPermissions().canViewAdminDashboard`
- **systemsUsed.ts**: New data layer with `fetchSystemsUsed`, `createSystemUsed`, `updateSystemUsed`, `setSystemUsedActive`, `deleteSystemUsed`
- **WorkSetup.tsx**: Replaced hardcoded `SYSTEMS_LIST` with DB-driven systems
  - Active systems shown normally; inactive/legacy selections shown with "Inactive" badge
  - "Other: ..." format preserved
- **LeftSidebar.tsx**: Added "Systems Used" nav item under Platform Settings
- **AdminInspectionTypes.tsx**: Removed duplicate `<AuthenticatedLayout>` wrapper (route-level layout only)
- **FEATURE_MAP.md**: Added `platform_systems_used` table and `/admin/systems-used` route documentation

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
