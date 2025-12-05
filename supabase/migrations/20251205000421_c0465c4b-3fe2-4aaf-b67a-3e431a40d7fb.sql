-- Backfill existing seeking_coverage_post transactions with related_entity fields
-- Only update rows that have post_id in metadata and related_entity fields are NULL
UPDATE public.vendor_credit_transactions
SET 
  related_entity_type = 'seeking_coverage_post',
  related_entity_id = (metadata->>'post_id')::uuid
WHERE 
  action = 'post_seeking_coverage'
  AND metadata->>'post_id' IS NOT NULL
  AND related_entity_type IS NULL
  AND related_entity_id IS NULL;