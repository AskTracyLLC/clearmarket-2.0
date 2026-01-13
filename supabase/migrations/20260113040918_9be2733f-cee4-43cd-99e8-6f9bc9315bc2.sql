-- Add "Submit Vendor Verification to Support" checklist item to Vendor Beta Onboarding
-- Idempotent: will not create duplicates if run multiple times

WITH tpl AS (
  SELECT id
  FROM checklist_templates
  WHERE name = 'Vendor Beta Onboarding'
    AND owner_type = 'system'
  LIMIT 1
),
base AS (
  SELECT ci.sort_order
  FROM checklist_items ci
  JOIN tpl ON ci.template_id = tpl.id
  WHERE ci.title = 'Complete your vendor profile'
  LIMIT 1
),
ins AS (
  SELECT
    tpl.id AS template_id,
    COALESCE(
      (SELECT sort_order FROM base) + 5,
      (SELECT COALESCE(MAX(sort_order), 0) FROM checklist_items WHERE template_id = tpl.id) + 10
    ) AS insert_sort_order
  FROM tpl
),
exists_check AS (
  SELECT 1 AS already_exists
  FROM checklist_items ci
  JOIN tpl ON ci.template_id = tpl.id
  WHERE ci.title = 'Submit Vendor Verification to Support'
  LIMIT 1
),
shift_later_items AS (
  UPDATE checklist_items
  SET sort_order = sort_order + 10
  WHERE template_id = (SELECT template_id FROM ins)
    AND sort_order >= (SELECT insert_sort_order FROM ins)
    AND NOT EXISTS (SELECT 1 FROM exists_check)
  RETURNING id
)
INSERT INTO checklist_items (
  template_id,
  title,
  description,
  auto_track_key,
  sort_order,
  is_required,
  role
)
SELECT
  ins.template_id,
  'Submit Vendor Verification to Support',
  'Submit your Vendor Verification request so ClearMarket Admin can review and approve your vendor status.',
  NULL,
  ins.insert_sort_order,
  true,
  'vendor'
FROM ins
WHERE NOT EXISTS (SELECT 1 FROM exists_check);