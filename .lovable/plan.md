
IMPLEMENT WITHOUT CHECK-INS. If anything is unclear, choose the safest default and proceed. Only return final file contents + migrations + a short manual checklist. Do NOT ask me questions.

GOAL
Fix “Forgot Password” emails not being delivered (ex: tracy@asktracyllc.com) by replacing Supabase’s default reset email flow with a CUSTOM public Edge Function that:
- generates a Supabase recovery link via Admin API
- sends the email via Resend (verified domain)
- logs every attempt for audit + troubleshooting
- rate-limits requests to prevent abuse
- never reveals whether an email exists (no user enumeration)

WHY CURRENT FLOW IS FAILING
ForgotPassword.tsx currently calls supabase.auth.resetPasswordForEmail(), which relies on Supabase’s built-in email provider settings. Our transactional email delivery should go through Resend, and the current setup is not reliably delivering (emails not arriving and not showing in Resend logs).

SCOPE
- Add a server-only audit table
- Add edge function: auth-send-recovery (public endpoint)
- Update ForgotPassword.tsx to invoke the edge function
- Update UpdatePassword.tsx (existing page) with a support link only
- Keep routes as-is:
  - /auth/forgot-password -> ForgotPassword.tsx
  - /auth/update-password -> UpdatePassword.tsx
NO unrelated refactors.

DATABASE CHANGES (NEW MIGRATION)
Create:
supabase/migrations/20260126_auth_recovery_email.sql

Requirements:
- Create table public.auth_recovery_email_attempts (idempotent)
Columns:
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
  email text NOT NULL
  email_normalized text GENERATED ALWAYS AS (lower(trim(email))) STORED
  request_ip_hash text NULL
  user_agent text NULL
  status text NOT NULL CHECK (status IN ('queued','sent','failed','rate_limited'))
  provider text NOT NULL DEFAULT 'resend'
  provider_message_id text NULL
  error_text text NULL
  created_at timestamptz NOT NULL DEFAULT now()

Security:
- Enable RLS
- NO client policies (no anon/authenticated access). This table is written only by the Edge Function using Service Role.

EDGE FUNCTION (THE FIX)
Create:
supabase/functions/auth-send-recovery/index.ts

Also update:
supabase/config.toml

Config MUST be:
[functions.auth-send-recovery]
verify_jwt = false

Reason: users aren’t logged in when resetting password; endpoint must be public. Rate limiting + logging provide abuse control.

ENV / SECRETS (EDGE FUNCTION)
Use these (support both base URL keys to avoid back-and-forth):
- SUPABASE_URL (required)
- SUPABASE_SERVICE_ROLE_KEY (required)
- RESEND_API_KEY (required)
- SITE_URL (preferred)
- APP_BASE_URL (fallback if SITE_URL not set)

BASE URL RESOLUTION LOGIC
In the edge function:
const baseUrl = Deno.env.get('SITE_URL') ?? Deno.env.get('APP_BASE_URL');
If neither exists, hard-fail internally, but STILL return generic success to client and log failed.

EDGE FUNCTION INPUT
POST JSON:
{
  "email": "user@example.com",
  "redirectTo": "https://useclearmarket.io/auth/update-password" // optional
}

DEFAULT redirectTo MUST be:
${baseUrl}/auth/update-password

EDGE FUNCTION BEHAVIOR (step-by-step)
1) Parse JSON and validate email (basic format). If invalid:
   - Log attempt as failed (error_text="invalid_email")
   - Return 200 with generic success message (no enumeration).

2) Normalize email: normalizedEmail = lower(trim(email))

3) Rate limiting (IMPORTANT TWEAK)
Count ALL attempts (any status) for email_normalized in last 10 minutes:
- If count >= 3:
  - Insert log row with status='rate_limited'
  - Return 200 with generic success message

4) Insert a log row with status='queued' (provider='resend')

5) Generate recovery link via Supabase Admin API:
   Use supabase.auth.admin.generateLink({
     type: 'recovery',
     email: normalizedEmail,
     options: { redirectTo }
   })
   Extract recovery URL from returned data:
   data.properties?.action_link (use the correct returned field; must work with supabase-js v2)

6) Send email via Resend:
   - From: "ClearMarket <hello@useclearmarket.io>"
   - To: original email (NOT normalized string if it changes casing; but either is fine)
   - Subject: "Reset your ClearMarket password"
   - HTML: dark theme matching ClearMarket styling, orange CTA button
   - Plain text fallback includes the link
   - Include ClearMarket logo if available (use a public URL if one exists in project; if not, omit logo rather than breaking email)

Branding guidance:
- Background: #24282D
- CTA: #D1532C
- Text: light/white

7) Update the queued log row:
   - On success: status='sent', provider_message_id set to Resend message id
   - On failure: status='failed', error_text includes safe error string (no secrets)

8) RESPONSE (NO ENUMERATION)
Always return HTTP 200:
{ "ok": true, "message": "If an account exists for this email, you’ll receive a reset link shortly." }
Even on internal errors.

OPTIONAL PRIVACY
If request IP is available, store a hashed value (not raw IP):
- request_ip_hash = sha256(ip + serverSalt) if feasible; if not, omit IP logging rather than store raw.
User agent: read from headers and store.

FRONTEND CHANGES

A) ForgotPassword.tsx
Replace supabase.auth.resetPasswordForEmail() with:
supabase.functions.invoke('auth-send-recovery', { body: { email, redirectTo } })

Rules:
- Always show the same success message after submit (no enumeration)
- Add helper text: check spam/promotions, wait 1–2 minutes, verify spelling
- Add “Contact support” link: mailto:hello@useclearmarket.io
- Add 60-second client-side cooldown to disable re-send / submit button after a request
- Keep styling consistent with existing ClearMarket dark UI and shadcn components

B) UpdatePassword.tsx
This route already exists and handles PASSWORD_RECOVERY.
Only add:
- A support link mailto:hello@useclearmarket.io on the page for issues
Do NOT rework the flow unless it is broken.

ROUTE ALIGNMENT
Do NOT create new reset routes.
Use existing:
- /auth/forgot-password
- /auth/update-password

MANUAL CHECKLIST (Lovable must include this at end)
Supabase Dashboard → Auth → URL Configuration
- Site URL: https://useclearmarket.io
- Add Redirect URLs:
  - https://useclearmarket.io/auth/update-password
  - http://localhost:5173/auth/update-password
  - http://localhost:8081/auth/update-password (only if used for local dev)

DEFINITION OF DONE
- Forgot password submit shows success message every time (no enumeration)
- Resend logs show the email was sent when the user exists
- DB table logs attempts with statuses: queued/sent/failed/rate_limited
- 4th attempt within 10 minutes is rate_limited (still returns success)
- Recovery link opens /auth/update-password and allows setting a new password
- User can log in with the new password

OUTPUT REQUIREMENTS
Return full contents of:
- supabase/migrations/20260126_auth_recovery_email.sql
- supabase/functions/auth-send-recovery/index.ts
- supabase/config.toml (only the relevant updated section if file is large; but do not break existing config)
- src/pages/ForgotPassword.tsx (full file)
- src/pages/UpdatePassword.tsx (full file)

No TODOs. No placeholders. No unrelated changes.
