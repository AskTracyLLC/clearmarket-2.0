/**
 * Client-side rate limiting using the check_rate_limit() Postgres function.
 * Uses auth.uid() when logged in, falls back to anonSessionId when logged out.
 */

import { supabase } from "@/integrations/supabase/client";
import { getAnonSessionId } from "./anonSession";

/** Predefined rate limit configurations for ClearMarket actions */
export const RATE_LIMITS = {
  send_message: { maxRequests: 10, windowSeconds: 60 },
  post_create: { maxRequests: 4, windowSeconds: 60 },
  comment_create: { maxRequests: 8, windowSeconds: 60 },
  report_content: { maxRequests: 5, windowSeconds: 300 },
  unlock_contact: { maxRequests: 3, windowSeconds: 300 },
  boost_post: { maxRequests: 2, windowSeconds: 300 },
  heavy_search: { maxRequests: 20, windowSeconds: 60 },
  admin_bulk_actions: { maxRequests: 5, windowSeconds: 60 },
  support_case: { maxRequests: 5, windowSeconds: 3600 }, // 5 per hour
} as const;

export type RateLimitAction = keyof typeof RATE_LIMITS;

type RateLimitArgs = {
  action: RateLimitAction | string;
  maxRequests?: number;
  windowSeconds?: number;
};

export type RateLimitResult = {
  allowed: boolean;
  error?: string;
};

/**
 * Check if an action is allowed under rate limiting rules.
 * Fails open (returns allowed: true) if the RPC errors, to avoid blocking legitimate users.
 */
export async function checkRateLimit({
  action,
  maxRequests,
  windowSeconds,
}: RateLimitArgs): Promise<RateLimitResult> {
  // Use predefined limits if available, otherwise require explicit params
  const limits = RATE_LIMITS[action as RateLimitAction];
  const max = maxRequests ?? limits?.maxRequests;
  const window = windowSeconds ?? limits?.windowSeconds;

  if (!max || !window) {
    console.warn(`No rate limit config for action: ${action}`);
    return { allowed: true };
  }

  const anonId = getAnonSessionId();

  try {
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_action: action,
      p_max_requests: max,
      p_window_seconds: window,
      p_identifier: anonId,
    });

    if (error) {
      // Fail-open: if rate limiter errors, do NOT hard block the app
      console.warn("Rate limit RPC error:", error.message);
      return { allowed: true, error: error.message };
    }

    return { allowed: Boolean(data) };
  } catch (err) {
    // Network errors, etc. - fail open
    console.warn("Rate limit check failed:", err);
    return { allowed: true };
  }
}

/**
 * User-friendly error messages for rate limit blocks
 */
export const RATE_LIMIT_MESSAGES: Record<RateLimitAction, string> = {
  send_message: "You're sending messages too quickly. Please wait a moment.",
  post_create: "You're creating posts too quickly. Please wait a moment.",
  comment_create: "You're commenting too quickly. Please wait a moment.",
  report_content: "You've submitted too many reports recently. Please wait before reporting again.",
  unlock_contact: "Too many unlock attempts. Please wait before trying again.",
  boost_post: "Too many boost attempts. Please wait before trying again.",
  heavy_search: "Too many searches. Please wait a moment.",
  admin_bulk_actions: "Too many bulk actions. Please wait a moment.",
  support_case: "Too many support cases created. Please wait and try again.",
};

/**
 * Get the user-friendly message for a rate limit action
 */
export function getRateLimitMessage(action: RateLimitAction | string): string {
  return (
    RATE_LIMIT_MESSAGES[action as RateLimitAction] ||
    "You're doing that too quickly. Please wait a moment."
  );
}
