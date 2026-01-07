-- Enable realtime on messages table so INSERT events are broadcast
-- (Required for client-side postgres_changes subscriptions to receive events)
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Ensure full row data is available to realtime consumers where needed
-- (Not strictly required for INSERT, but helpful for UPDATE/DELETE debugging)
ALTER TABLE public.messages REPLICA IDENTITY FULL;