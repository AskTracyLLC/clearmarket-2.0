# ClearMarket Feature Map

Quick reference for UI routes, backend objects, and their connections.

---

## 1. UI Feature Map

### Vendor Routes

- `/vendor/seeking-coverage` — Create/manage coverage posts (costs 1 credit)
  - Components: `SeekingCoverageDialog`, `VendorPostPricingAlert`
- `/vendor/seeking-coverage/:postId/interested` — Review interested reps
  - Components: `ExpressInterestDialog`, `DeclineRepDialog`
- `/vendor/my-reps` — Connected reps management + internal rep notes + Do Not Use list (as tabs)
  - Components: `MyRepsTable`, `VendorRepNotesDrawer`, `ReviewDialog`, `VendorDoNotUseReps`, `MarkDoNotUseDialog`, `VendorOfflineRepContacts`
- `/vendor/find-reps` — Search rep directory
  - Components: `RepCoverageTable`, `PublicProfileDialog`
- `/vendor/staff` — Team management + staff notes
  - Components: `VendorStaffEmailsCard`, `VendorStaffNotesDrawer`
- `/vendor/credits` — Credit balance (shared vendor wallet), purchase, history
  - Components: `ConfirmCreditSpendDialog`, `OutOfCreditsDialog`
- `/vendor/checklists` — Onboarding checklists for reps
  - Components: `VendorChecklistManager`, `AssignChecklistDialog`
- `/vendor/proposals` — Rate proposal builder
  - Components: `VendorProposalBuilder`, `ShareProposalDialog`
- `/vendor/reviews` — Received/given reviews
  - Components: `ReviewsTable`, `VendorReputationSnapshot`
- `/vendor/working-terms-review/:requestId` — Accept/reject terms
  - Components: `WorkingTermsDialog`, `AgreementDetailsDialog`

### Field Rep Routes

- `/rep/find-work` — Browse seeking coverage posts
  - Components: `ExpressInterestDialog`, `SaveSearchDialog`
- `/rep/seeking-coverage/:postId` — Post detail view
  - Components: `RepSeekingCoveragePost`
- `/rep/my-vendors` — Connected vendors + private notes
  - Components: `ConnectedVendorsTable`, `MyVendorContacts`
- `/rep/find-vendors` — Vendor directory
  - Components: `RepFindVendors`
- `/rep/profile` — Profile editor
  - Components: `RepProfile`, `CoverageAreaDialog`
- `/rep/reviews` — Trust score, reviews
  - Components: `RepReputationSnapshot`, `ReviewsTable`
- `/rep/availability` — Availability & vendor network alerts
  - Components: `UnifiedAvailabilityCalendar`, `PlannedRouteConfirmBanner`, `MyVendorContacts`
  - Features: Time off management, unified calendar view, alert sending (planned time off, emergency, availability update, planned route)
- `/rep/calendar` — Availability calendar
  - Components: `CalendarMonthView`, `AddCalendarEventDialog`
- `/rep/working-terms-request/:requestId` — Submit terms
  - Components: `WorkingTermsDialog`
- `/work-setup` — Coverage areas + systems setup
  - Components: `WorkSetup`, `InspectionTypeMultiSelect`

### Admin Routes

- `/admin/support-queue` — Unified support/moderation queue
  - Components: `SupportQueueItemCard`, `SupportQueueItemDetail`
- `/admin/users` — User search, deactivate, reset
  - Components: `AdminUsers`, `AdminMessageUserDialog`
- `/admin/staff` — Staff role management
  - Components: `AdminStaff`
- `/admin/credits` — Manual credit adjustments (vendor_wallet)
  - Search: company name, Vendor Code (`vendor_public_code`), Vendor # (`anonymous_id`), owner email
  - Components: `AdminCredits`
- `/admin/audit` — Activity log
  - Components: `AdminAuditLog`
- `/admin/broadcasts` — System announcements
  - Components: `AdminBroadcasts`, `AdminBroadcastNew`
- `/admin/checklists` — Global checklist templates
  - Components: `AdminChecklists`
- `/admin/features` — Feature flags
  - Components: `AdminFeatureFlags`
- `/admin/inspection-types` — Admin-managed inspection types & categories
  - Components: `AdminInspectionTypes`
- `/admin/systems-used` — Admin-managed systems for Work Setup
  - Components: `AdminSystemsUsed`
- `/admin/background-checks` — Review submitted checks
  - Components: `AdminBackgroundChecks`
- `/admin/safety-analytics` — Safety metrics
  - Components: `SafetyAnalyticsTab`

### Shared Routes

- `/dashboard` — Role-aware home (credits from vendor_wallet for vendors)
  - Components: `TodayFeed`, `QuickActions`, `AtAGlanceSidebar`
- `/messages`, `/messages/:conversationId` — Messaging
  - Components: `MessagesList`, `MessageThread`
- `/community`, `/community/:postId` — Community board
  - Components: `CommunityTab`, `CommunityPostDialog`
- `/notifications` — In-app notifications
  - Components: `NotificationFeed`, `NotificationsDropdown`
- `/coverage-map` — Interactive US map
  - Components: `USChoroplethMap`
- `/support` — Submit support ticket
  - Components: `Support`

### Public Routes

- `/help/*` — Help Center (no auth required; works for public + demo + signed-in)
  - Components: `PublicHelpCenter`
- `/snapshot/:slug` — Public reputation snapshot
- `/share/rep/:slug`, `/share/vendor/:slug` — Profile share pages
- `/p/:shareToken` — Public proposal view
- `/rep/reviews/:id`, `/vendor/reviews/:id` — Public reviews

---

## 2. Backend Feature Map

### Core Tables

- `profiles` — User identity, role flags, codes
- `rep_profile` — Rep-specific: coverage areas, systems, rates
- `vendor_profile` — Vendor-specific: company info, regions
- `vendor_connections` — Rep↔Vendor relationships
- `connection_agreement_areas` — Agreed coverage terms
- `seeking_coverage_posts` — Vendor job posts
- `rep_interest` — Rep applications to posts
- `messages`, `conversations` — Messaging system
- `notifications` — In-app notifications
- `connection_reviews` — Work-tied reviews (Trust Score)
- `community_posts`, `community_comments`, `community_votes` — Community board

### Credits System

> **Credit System Rule:** Vendor credits live in `vendor_wallet`. Rep credits (if enabled) live in `user_wallet`. Never mix spend/adjust flows across them.

**Vendor Credits (vendor_wallet)**
- `vendor_wallet` — Shared credit balance per vendor (keyed by vendor_profile.id)
- `vendor_wallet_transactions` — Transaction log for vendor wallet
- `pending_credit_purchases` — Pending Stripe purchases
- `spend_vendor_credits` (RPC) — Atomic credit deduction with auth check
- `add_vendor_credits` (RPC) — Add credits (service-role, admin adjustments, purchases)

**Rep Credits (user_wallet) — if enabled**
- `user_wallet` — Per-user credit balance for field reps
- `vendor_credit_transactions` — Legacy transaction log (being deprecated)

> **Note:** Admin adjustments for vendors use `admin-adjust-credits` edge function which writes to `vendor_wallet`. Rep credit adjustments (if enabled) would require a separate flow targeting `user_wallet`.

### Notes & Preferences

- `vendor_staff_notes` — Internal staff notes (public/private audience)
- `vendor_rep_notes` — Internal rep notes (vendor-scoped, hidden from reps)
- `connection_notes` — CRM-style notes per vendor/rep connection (side: vendor | rep)
- `user_ui_preferences` — Pinned sidebar items per user (persisted across sessions)
- `vendor_do_not_use_reps` — Vendor-scoped DNU list (rep_user_id for on-platform, or just name/email for offline)
  - RLS: vendor members SELECT, vendor admin/owner INSERT/UPDATE/DELETE
  - Separate from `vendor_offline_rep_contacts` (no schema overlap)

### Safety & Moderation

- `support_tickets` — Support cases
- `admin_audit_log` — Staff action audit trail
- `user_blocks`, `user_reports` — Safety/moderation

### Teams & Checklists

- `checklist_templates`, `checklist_items`, `user_checklist_items` — Checklists
- `onboarding_rewards` — Idempotent reward tracking
  - Rep milestone: `rep_profile_pricing_v1` (2 credits for profile + pricing)
  - Rep full: `rep_onboarding_complete_v1` (remaining credits to reach 5 total)
  - Vendor: `vendor_onboarding_complete_v1` (5 credits)
- `user_wallet_transactions` — Rep credit audit trail (txn_type, delta, metadata, timestamp)
- `rep_profile_pricing_status` — View: rep profile details + coverage pricing completion
- `rep_onboarding_status` — View: REQUIRED-only rep onboarding (profile + pricing + route alert)
- `rep_alert_sent_status` — View: has rep sent at least one alert (vendor_alerts)
- `vendor_onboarding_status` — View: REQUIRED-only vendor completion status
- `award_rep_profile_pricing_credits()` — RPC: award 2-credit milestone
- `award_rep_onboarding_credits()` — RPC: award remaining credits (5 - already earned)
- `get_rep_reward_summary()` — RPC: returns full rep reward status JSON
- `vendor_staff` — Team members (with can_spend_credits flag)
- `vendor_offline_rep_contacts` — Do Not Assign list (status='blocked')

### Terms & Proposals

- `working_terms_requests`, `working_terms_rows` — Terms negotiation
- `vendor_proposals`, `vendor_proposal_items` — Rate proposals

### System

- `admin_broadcasts`, `admin_broadcast_recipients` — Announcements
- `feature_flags` — Feature toggles
- `platform_systems_used` — Admin-managed systems for Work Setup (label, code, is_active, sort_order)
- `inspection_type_options`, `inspection_categories` — Admin-managed inspection types
- `background_checks` — Rep background verification
- `dual_role_access_requests` — Vendor role requests

### Edge Functions

- `stripe-webhook` — Stripe payment processing
- `create-credit-checkout` — Initiate credit purchase (writes to vendor_wallet)
- `admin-adjust-credits` — Manual credit adjustment (vendor_wallet)
- `reconcile-pending-purchases` — Cleanup pending transactions
- `stripe-health` — Stripe connection status
- `send-notification-email` — Transactional emails
- `daily-digest-emails` — Digest sender
- `review-reminder` — 30-day review prompts
- `send-admin-broadcast-emails` — Broadcast email delivery
- `invite-vendor-staff` — Staff invite sender
- `accept-staff-invite` — Staff invite acceptance
- `get-staff-invite-details` — Validate invite tokens
- `create-staff-user` — Create staff account
- `admin-delete-user` — Hard delete user
- `admin-audit-log` — Log staff actions
- `create-support-case` — Submit support ticket
- `vendor-verification-submit` — GL verification submit
- `send-vendor-verification-nudge` — Nudge unverified vendors
- `validate-invite-code` — Beta invite validation
- `public-profile-share` — Generate share links
- `get_public_reputation_snapshot` — Public reputation data
- `guard_contact_access` — Credit-gated contact unlock
- `send-rep-network-alert` — Rep match alerts
- `send-vendor-network-alerts` — Vendor match alerts
- `process-vendor-contact-matches` — Link offline contacts
- `send-demo-request` — Demo request emails

### Integrations

- **Stripe** — Credit purchases, webhook handling
- **Resend** — Transactional & digest emails

---

## 3. Route → Backend Crosswalk

### Vendor

| Route | Tables | Edge Functions / RPC |
|-------|--------|----------------------|
| `/vendor/seeking-coverage` | `seeking_coverage_posts`, `vendor_wallet`, `vendor_wallet_transactions` | `spend_vendor_credits` (RPC) |
| `/vendor/seeking-coverage/:postId/interested` | `rep_interest`, `profiles`, `rep_profile` | — |
| `/vendor/my-reps` | `vendor_connections`, `connection_notes`, `vendor_rep_notes`, `connection_reviews`, `vendor_do_not_use_reps` | — |
| `/vendor/staff` | `vendor_staff`, `vendor_staff_notes` | `invite-vendor-staff` |
| `/vendor/credits` | `vendor_wallet`, `vendor_wallet_transactions`, `pending_credit_purchases` | `create-credit-checkout`, `stripe-webhook` |
| `/vendor/checklists` | `checklist_templates`, `checklist_items`, `user_checklist_items` | — |
| `/vendor/proposals` | `vendor_proposals`, `vendor_proposal_items` | `public-profile-share` |
| `/vendor/working-terms-review/:requestId` | `working_terms_requests`, `working_terms_rows`, `connection_agreement_areas` | — |

### Field Rep

| Route | Tables | Edge Functions |
|-------|--------|----------------|
| `/rep/find-work` | `seeking_coverage_posts`, `rep_interest`, `saved_searches` | — |
| `/rep/my-vendors` | `vendor_connections`, `connection_notes` | — |
| `/rep/profile` | `rep_profile`, `profiles` | — |
| `/rep/reviews` | `connection_reviews`, `profiles` | — |
| `/work-setup` | `rep_profile` (or `vendor_profile`), `platform_systems_used` | — |
| `/rep/working-terms-request/:requestId` | `working_terms_requests`, `working_terms_rows` | — |

### Admin

| Route | Tables | Edge Functions |
|-------|--------|----------------|
| `/admin/support-queue` | `support_tickets`, `user_reports`, `dual_role_access_requests` | `create-support-case` |
| `/admin/users` | `profiles`, `rep_profile`, `vendor_profile` | `admin-delete-user` |
| `/admin/credits` | `vendor_wallet` (admin RLS for read), `vendor_wallet_transactions` (admin RLS for read), `vendor_profile` (search by company_name, vendor_public_code, anonymous_id), `admin_audit_log` | `admin-adjust-credits` |
| `/admin/audit` | `admin_audit_log` | `admin-audit-log` |
| `/admin/broadcasts` | `admin_broadcasts`, `admin_broadcast_recipients` | `send-admin-broadcast-emails` |
| `/admin/background-checks` | `background_checks` | — |

### Shared

| Route | Tables | Edge Functions |
|-------|--------|----------------|
| `/dashboard` | `profiles`, `vendor_wallet` (vendors), `notifications` | — |
| `/messages` | `conversations`, `messages` | `send-notification-email` |
| `/community` | `community_posts`, `community_comments`, `community_votes` | — |
| `/notifications` | `notifications` | — |
| `/support` | `support_tickets` | `create-support-case` |
| Sidebar pins | `user_ui_preferences` | — |

### Public

| Route | Tables | Edge Functions |
|-------|--------|----------------|
| `/snapshot/:slug` | `profiles`, `connection_reviews` | `get_public_reputation_snapshot` |
| `/p/:shareToken` | `vendor_proposals` | — |
