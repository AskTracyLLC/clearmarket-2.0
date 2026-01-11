-- Step 1: Ensure canonical support threads have conversation_type = 'support'
UPDATE public.conversations
SET conversation_type = 'support'
WHERE category = 'support:vendor_verification'
  AND conversation_type IS DISTINCT FROM 'support';

-- Step 2: Reclassify ONLY legacy vendor_verification threads (avoid clobbering other categories)
UPDATE public.conversations
SET
  category = 'support:vendor_verification',
  conversation_type = 'support'
WHERE conversation_type = 'vendor_verification'
  AND (category IS NULL OR category NOT LIKE 'support:%');

-- Step 3: One-time merge function (handles swapped participant ordering)
CREATE OR REPLACE FUNCTION public.merge_legacy_vendor_verification_threads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vendor_record RECORD;
  canonical_conv_id UUID;
  legacy_conv RECORD;
BEGIN
  FOR vendor_record IN
    SELECT
      LEAST(participant_one, participant_two) AS p_low,
      GREATEST(participant_one, participant_two) AS p_high,
      COUNT(*) AS conv_count
    FROM public.conversations
    WHERE category = 'support:vendor_verification'
    GROUP BY 1,2
    HAVING COUNT(*) > 1
  LOOP
    -- Pick canonical: most messages, then oldest
    SELECT c.id INTO canonical_conv_id
    FROM public.conversations c
    LEFT JOIN (
      SELECT conversation_id, COUNT(*) AS msg_count
      FROM public.messages
      GROUP BY conversation_id
    ) m ON m.conversation_id = c.id
    WHERE c.category = 'support:vendor_verification'
      AND LEAST(c.participant_one, c.participant_two) = vendor_record.p_low
      AND GREATEST(c.participant_one, c.participant_two) = vendor_record.p_high
    ORDER BY COALESCE(m.msg_count, 0) DESC, c.created_at ASC
    LIMIT 1;

    IF canonical_conv_id IS NULL THEN
      CONTINUE;
    END IF;

    FOR legacy_conv IN
      SELECT c.id
      FROM public.conversations c
      WHERE c.category = 'support:vendor_verification'
        AND LEAST(c.participant_one, c.participant_two) = vendor_record.p_low
        AND GREATEST(c.participant_one, c.participant_two) = vendor_record.p_high
        AND c.id <> canonical_conv_id
    LOOP
      -- Move messages
      UPDATE public.messages
      SET conversation_id = canonical_conv_id
      WHERE conversation_id = legacy_conv.id;

      -- Archive legacy conversation
      UPDATE public.conversations
      SET
        hidden_for_one = true,
        hidden_for_two = true,
        category = 'archived:vendor_verification_merged'
      WHERE id = legacy_conv.id;
    END LOOP;

    -- Recompute last_message_at for canonical
    UPDATE public.conversations
    SET last_message_at = (
      SELECT MAX(created_at)
      FROM public.messages
      WHERE conversation_id = canonical_conv_id
    )
    WHERE id = canonical_conv_id;
  END LOOP;
END;
$$;

-- Step 4: Run it
SELECT public.merge_legacy_vendor_verification_threads();

-- Step 5: Drop it
DROP FUNCTION IF EXISTS public.merge_legacy_vendor_verification_threads();