-- Add per-user archive/hide columns to conversations
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS hidden_for_one boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS hidden_for_two boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.conversations.hidden_for_one IS
  'If true, conversation is archived/hidden for participant_one only.';

COMMENT ON COLUMN public.conversations.hidden_for_two IS
  'If true, conversation is archived/hidden for participant_two only.';