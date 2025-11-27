-- Create conversations table for 1:1 messaging
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  participant_one uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_two uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message_at timestamptz,
  last_message_preview text,
  is_pinned_for_one boolean DEFAULT false,
  is_pinned_for_two boolean DEFAULT false,
  CONSTRAINT conversations_participants_unique UNIQUE (participant_one, participant_two)
);

COMMENT ON TABLE public.conversations IS '1:1 conversations between users. Participant order matters for uniqueness constraint.';
COMMENT ON COLUMN public.conversations.participant_one IS 'First participant (lower UUID). Always store participants sorted for unique constraint.';
COMMENT ON COLUMN public.conversations.participant_two IS 'Second participant (higher UUID). Always store participants sorted for unique constraint.';

-- Enable RLS on conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Add updated_at trigger to conversations
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update messages table to support conversations
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.messages.conversation_id IS 'Parent conversation for this 1:1 message';

-- RLS policies for conversations
CREATE POLICY "Users can view their own conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (
  auth.uid() = participant_one OR auth.uid() = participant_two
);

CREATE POLICY "Users can create conversations they participate in"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = participant_one OR auth.uid() = participant_two
);

CREATE POLICY "Users can update their own conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (
  auth.uid() = participant_one OR auth.uid() = participant_two
);

-- Drop existing conflicting message policies if they exist
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;

-- RLS policies for messages (conversation-aware)
CREATE POLICY "Users can view messages in their conversations"
ON public.messages
FOR SELECT
TO authenticated
USING (
  auth.uid() = sender_id OR auth.uid() = recipient_id
);

CREATE POLICY "Users can send messages in their conversations"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND conversation_id IN (
    SELECT id FROM public.conversations
    WHERE participant_one = auth.uid() OR participant_two = auth.uid()
  )
);