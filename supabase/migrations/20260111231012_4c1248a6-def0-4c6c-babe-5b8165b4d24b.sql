-- Prevent duplicate vendor verification support threads per participant pair
CREATE UNIQUE INDEX IF NOT EXISTS ux_conversations_support_vendor_verification_pair
ON public.conversations (
  category,
  LEAST(participant_one, participant_two),
  GREATEST(participant_one, participant_two)
)
WHERE category = 'support:vendor_verification';