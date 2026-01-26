-- Migration: Custom password recovery email logging and rate limiting
-- This table is written only by the Edge Function using Service Role

BEGIN;

-- Create the auth_recovery_email_attempts table
CREATE TABLE IF NOT EXISTS public.auth_recovery_email_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  email_normalized text GENERATED ALWAYS AS (lower(trim(email))) STORED,
  request_ip_hash text NULL,
  user_agent text NULL,
  status text NOT NULL CHECK (status IN ('queued','sent','failed','rate_limited')),
  provider text NOT NULL DEFAULT 'resend',
  provider_message_id text NULL,
  error_text text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for rate limiting queries
CREATE INDEX IF NOT EXISTS idx_auth_recovery_email_attempts_normalized_created 
  ON public.auth_recovery_email_attempts (email_normalized, created_at);

-- Enable RLS (no client policies - server-only writes via service role)
ALTER TABLE public.auth_recovery_email_attempts ENABLE ROW LEVEL SECURITY;

-- Explicitly revoke all access from anon and authenticated
REVOKE ALL ON public.auth_recovery_email_attempts FROM anon;
REVOKE ALL ON public.auth_recovery_email_attempts FROM authenticated;

-- Grant to service_role only (edge functions use this)
GRANT ALL ON public.auth_recovery_email_attempts TO service_role;

COMMIT;