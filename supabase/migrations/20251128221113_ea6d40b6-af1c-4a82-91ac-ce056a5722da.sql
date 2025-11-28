-- Add rep_interest_id to conversations table to link conversations to rep_interest rows
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS rep_interest_id uuid REFERENCES rep_interest(id) ON DELETE SET NULL;

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_conversations_rep_interest_id ON conversations(rep_interest_id);

COMMENT ON COLUMN conversations.rep_interest_id IS 'Links this conversation to the rep_interest row (for Seeking Coverage conversations only)';