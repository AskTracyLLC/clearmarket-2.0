-- Create user_blocks table for blocking functionality
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  blocker_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text,
  CONSTRAINT user_blocks_unique_pair UNIQUE (blocker_user_id, blocked_user_id),
  CONSTRAINT user_blocks_no_self_block CHECK (blocker_user_id != blocked_user_id)
);

COMMENT ON TABLE public.user_blocks IS 'One-way blocks between users; if A blocks B, A never sees B again in discovery/messaging.';
COMMENT ON COLUMN public.user_blocks.blocker_user_id IS 'User who initiated the block.';
COMMENT ON COLUMN public.user_blocks.blocked_user_id IS 'User who is being blocked.';
COMMENT ON COLUMN public.user_blocks.reason IS 'Optional reason for the block (internal note).';

-- Enable RLS
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own blocks"
ON public.user_blocks
FOR SELECT
TO authenticated
USING (auth.uid() = blocker_user_id);

CREATE POLICY "Users can create blocks on others"
ON public.user_blocks
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = blocker_user_id);

CREATE POLICY "Users can remove their own blocks"
ON public.user_blocks
FOR DELETE
TO authenticated
USING (auth.uid() = blocker_user_id);

-- Create index for performance
CREATE INDEX idx_user_blocks_blocker ON public.user_blocks(blocker_user_id);
CREATE INDEX idx_user_blocks_blocked ON public.user_blocks(blocked_user_id);