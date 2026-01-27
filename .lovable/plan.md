
# Vendor Onboarding Rewards v2 - Implementation Plan

## Overview
Implement a two-tier vendor onboarding reward system that aligns with the 10-item checklist UI, awarding 2 credits for the milestone (profile + verification) and 3 credits for completing all onboarding items.

## Pre-Implementation Fix Required
One bug in the existing codebase must be fixed as part of this implementation:

The `vendor_pricing_saved` evaluation in `checklistTracking.ts` queries a non-existent table (`vendor_coverage_focus`). This will be fixed to check `seeking_coverage_posts` for posts with pricing set.

## Reward Tiers

| Tier | Reward Key | Credits | Requirements |
|------|------------|---------|--------------|
| Milestone | `vendor_profile_verification_v1` | 2 | Profile complete + Verification submitted |
| Full Onboarding | `vendor_onboarding_complete_v1` | 3 (remainder) | All 10 checklist items complete |
| **Total Cap** | - | **5** | - |

## Database Changes

### Migration: `20260127_vendor_onboarding_rewards_v2.sql`

**1. New View: `vendor_profile_verification_status`**
Validates milestone requirements (2 credits):
- company_name exists
- city AND state exist  
- primary_inspection_types has at least 1 item
- At least 1 vendor_coverage_areas entry (using `vp.user_id`)
- vendor_verification_status IS NOT NULL AND vendor_verification_status <> 'draft' (NULL-safe)

**2. Updated View: `vendor_onboarding_status`**
Expands to all 10 items using correct ID mappings:
- All 5 milestone items above, PLUS:
- first_seeking_coverage_post (seeking_coverage_posts.vendor_id = vp.user_id)
- first_rep_message_sent (via user_checklist_items)
- vendor_pricing_saved (seeking_coverage_posts with pay_max IS NOT NULL)
- first_agreement_created (vendor_connections.vendor_id = vp.user_id)
- first_rep_review_submitted (reviews.reviewer_id = vp.user_id, direction = 'vendor_to_rep')
- first_route_alert_acknowledged (via user_checklist_items)
- vendor_calendar_updated (vendor_office_hours OR vendor_calendar_events)

**3. New RPC: `award_vendor_profile_verification_credits(p_vendor_id)`**
- Validates caller has vendor access via `has_vendor_access_by_profile(p_vendor_id)`
- Checks `vendor_profile_verification_status.is_complete`
- Awards 2 credits if not already awarded
- Uses `reward_key = 'vendor_profile_verification_v1'`
- Logs to `vendor_wallet_transactions` with `txn_type = 'reward_profile_verification'`
- Uses `ON CONFLICT DO NOTHING` + `GET DIAGNOSTICS` for idempotency

**4. Updated RPC: `award_vendor_onboarding_credits(p_vendor_id)`**
- Checks `vendor_onboarding_status.is_complete` (validates all 10 items)
- Calculates: `already_awarded = sum of profile_verification + any previous onboarding`
- Awards: `remaining = GREATEST(5 - already_awarded, 0)`
- Skips insert if remaining = 0 (no clutter)
- Uses `reward_key = 'vendor_onboarding_complete_v1'`
- Logs with `txn_type = 'reward_onboarding'`

**5. New RPC: `get_vendor_reward_summary(p_vendor_id)`**
Returns JSON:
- milestone_complete, milestone_missing, milestone_earned, milestone_credits
- onboarding_complete, onboarding_missing, onboarding_earned, onboarding_credits
- total_earned, total_possible (5), remaining

### Idempotency Safeguards (Already in Place)
- UNIQUE constraint: `UNIQUE(subject_type, subject_id, reward_key)` on `onboarding_rewards`
- `ON CONFLICT DO NOTHING` in all RPCs
- `GET DIAGNOSTICS` to check if insert succeeded before crediting

## Frontend Changes

### 1. Fix: `src/lib/checklistTracking.ts`
Update `vendor_pricing_saved` evaluation:

```typescript
case "vendor_pricing_saved": {
  // Vendor has at least one seeking coverage post with pricing
  const { count } = await client
    .from("seeking_coverage_posts")
    .select("*", { count: "exact", head: true })
    .eq("vendor_id", userId)
    .not("pay_max", "is", null);
  
  return (count ?? 0) > 0;
}
```

### 2. Update: `src/hooks/useOnboardingReward.ts`
Add tiered vendor reward support:
- Fetch both `vendor_profile_verification_status` and `vendor_onboarding_status`
- Check for both reward keys: `vendor_profile_verification_v1`, `vendor_onboarding_complete_v1`
- Add `claimMilestoneReward()` function for 2-credit milestone
- Auto-claim milestone first when complete, then full onboarding

### 3. Update: `src/components/GettingStartedChecklist.tsx`
Update reward banner to show tiered progress:
- "Earn 2 credits: Complete profile basics and submit verification"
- "Earn 3 more credits: Complete all onboarding steps"
- Show which tier is earned/claimable
- Different states for: pending, milestone earned, full earned

### 4. Update: `src/copy/gettingStartedChecklistCopy.ts`
Add vendor-specific tiered copy:
```typescript
vendorReward: {
  milestoneTitle: "Complete profile + verification -> Earn 2 credits",
  milestonePending: "Finish your profile and submit verification to claim.",
  milestoneEarned: "2 credits earned!",
  fullTitle: "Complete all onboarding -> Earn 3 more credits",
  fullPending: "Finish the remaining steps to claim your bonus.",
  fullEarned: "3 credits earned!",
}
```

## Edge Cases Handled

1. **Vendor#9 (already awarded 5 credits)**: 
   - Has `onboarding_complete_v1` with 5 credits
   - New `vendor_profile_verification_v1` won't be awarded (total would exceed cap)
   - Remaining calculation: `5 - 5 = 0`, so no new rewards

2. **Staff users**: 
   - Share vendor owner's progress via `has_vendor_access_by_profile`
   - Cannot claim rewards themselves (mimic check in hook)

3. **Concurrent requests**: 
   - UNIQUE constraint prevents duplicate receipts
   - `ON CONFLICT DO NOTHING` + `GET DIAGNOSTICS` ensures atomicity

4. **remaining = 0**: 
   - Skip insert entirely (no clutter, no "earned 0 credits" receipts)

5. **NULL verification status**: 
   - Properly handled with `IS NULL` check (not `NOT IN`)

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/20260127_vendor_onboarding_rewards_v2.sql` | New migration with views and RPCs |
| `src/lib/checklistTracking.ts` | Fix vendor_pricing_saved evaluation |
| `src/hooks/useOnboardingReward.ts` | Tiered vendor reward support |
| `src/components/GettingStartedChecklist.tsx` | Tiered UI display |
| `src/copy/gettingStartedChecklistCopy.ts` | Vendor tiered copy |

## Technical Notes

### ID Mapping Reference
| Table | Key Column | References |
|-------|------------|------------|
| seeking_coverage_posts | vendor_id | profiles.id (user_id) |
| vendor_connections | vendor_id | profiles.id (user_id) |
| vendor_calendar_events | vendor_id | profiles.id (user_id) |
| vendor_office_hours | vendor_id | profiles.id (user_id) |
| vendor_coverage_areas | user_id | profiles.id |
| reviews | reviewer_id | profiles.id |
| vendor_wallet | vendor_id | vendor_profile.id |
| onboarding_rewards | subject_id | vendor_profile.id |

### Checklist Items Validation Reference
| Item | Validation Method |
|------|-------------------|
| company_name | `vp.company_name IS NOT NULL` |
| location | `vp.city IS NOT NULL AND vp.state IS NOT NULL` |
| inspection_types | `array_length(vp.primary_inspection_types, 1) > 0` |
| coverage_area | `EXISTS (vendor_coverage_areas WHERE user_id = vp.user_id)` |
| verification_submitted | `vp.vendor_verification_status IS NOT NULL AND <> 'draft'` |
| first_seeking_coverage_post | `EXISTS (seeking_coverage_posts WHERE vendor_id = vp.user_id)` |
| vendor_pricing_saved | `EXISTS (seeking_coverage_posts WHERE vendor_id = vp.user_id AND pay_max IS NOT NULL)` |
| first_agreement_created | `EXISTS (vendor_connections WHERE vendor_id = vp.user_id)` |
| first_rep_review_submitted | `EXISTS (reviews WHERE reviewer_id = vp.user_id AND direction = 'vendor_to_rep')` |
| first_rep_message_sent | Via `user_checklist_items` completion |
| first_route_alert_acknowledged | Via `user_checklist_items` completion |
| vendor_calendar_updated | `EXISTS (vendor_office_hours OR vendor_calendar_events WHERE vendor_id = vp.user_id)` |
