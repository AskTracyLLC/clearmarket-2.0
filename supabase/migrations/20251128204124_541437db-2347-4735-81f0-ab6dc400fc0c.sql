-- Allow multiple conversations between the same two participants, one per Seeking Coverage post
-- by changing the unique constraint from (participant_one, participant_two)
-- to (participant_one, participant_two, origin_post_id)

-- Drop the old unique constraint on participant pair
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_participants_unique;

-- Create a new unique index that also includes origin_post_id
-- This allows the same two people to have multiple conversations if they're for different posts
CREATE UNIQUE INDEX IF NOT EXISTS conversations_participants_origin_unique
ON public.conversations (participant_one, participant_two, origin_post_id);