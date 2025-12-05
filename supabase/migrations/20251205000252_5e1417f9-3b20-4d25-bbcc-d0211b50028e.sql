-- Add related action tracking columns to vendor_credit_transactions
ALTER TABLE public.vendor_credit_transactions
ADD COLUMN IF NOT EXISTS related_entity_type text,
ADD COLUMN IF NOT EXISTS related_entity_id uuid;

COMMENT ON COLUMN public.vendor_credit_transactions.related_entity_type IS
  'Optional generic tag for what this transaction is tied to (e.g., seeking_coverage_post, boost, unlock_contact).';

COMMENT ON COLUMN public.vendor_credit_transactions.related_entity_id IS
  'Optional reference id pointing to the related entity (e.g., post id for a seeking coverage post).';