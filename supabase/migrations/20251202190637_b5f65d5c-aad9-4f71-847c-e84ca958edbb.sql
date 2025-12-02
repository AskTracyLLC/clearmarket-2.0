-- Add Community Score columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS community_score integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS community_score_last_calculated timestamptz;

COMMENT ON COLUMN public.profiles.community_score IS
  'Score derived from Community Board helpful/not-helpful votes on this user''s posts and comments.';

COMMENT ON COLUMN public.profiles.community_score_last_calculated IS
  'Timestamp when community_score was last fully recalculated.';

-- Function to calculate community score for a user
CREATE OR REPLACE FUNCTION public.calculate_community_score(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN v.vote_type = 'helpful' THEN 1
      WHEN v.vote_type = 'not_helpful' THEN -1
      ELSE 0
    END
  ), 0)::integer AS score
  FROM public.community_votes v
  LEFT JOIN public.community_posts p
    ON v.target_type = 'post' AND v.target_id = p.id
  LEFT JOIN public.community_comments c
    ON v.target_type = 'comment' AND v.target_id = c.id
  WHERE 
    -- Target belongs to the user
    (
      (v.target_type = 'post' AND p.author_id = p_user_id)
      OR
      (v.target_type = 'comment' AND c.author_id = p_user_id)
    )
    -- Exclude self-votes
    AND v.user_id <> p_user_id;
$$;

-- Function to refresh and store community score for a user
CREATE OR REPLACE FUNCTION public.refresh_community_score_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_score integer;
BEGIN
  new_score := public.calculate_community_score(p_user_id);

  UPDATE public.profiles
  SET community_score = new_score,
      community_score_last_calculated = now()
  WHERE id = p_user_id;
END;
$$;

-- Trigger function to update community score when votes change
CREATE OR REPLACE FUNCTION public.community_votes_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_author uuid;
  v_target_type text;
  v_target_id uuid;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_target_type := OLD.target_type;
    v_target_id := OLD.target_id;
  ELSE
    v_target_type := NEW.target_type;
    v_target_id := NEW.target_id;
  END IF;

  IF v_target_type = 'post' THEN
    SELECT author_id INTO target_author
    FROM public.community_posts
    WHERE id = v_target_id;
  ELSIF v_target_type = 'comment' THEN
    SELECT author_id INTO target_author
    FROM public.community_comments
    WHERE id = v_target_id;
  END IF;

  IF target_author IS NOT NULL THEN
    PERFORM public.refresh_community_score_for_user(target_author);
  END IF;

  RETURN NULL;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS community_votes_after_change ON public.community_votes;

CREATE TRIGGER community_votes_after_change
AFTER INSERT OR UPDATE OR DELETE ON public.community_votes
FOR EACH ROW
EXECUTE FUNCTION public.community_votes_after_change();