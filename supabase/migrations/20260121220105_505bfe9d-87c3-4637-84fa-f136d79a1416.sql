-- Ensure system column exists for ClearCheck imports
ALTER TABLE public.clearcheck_orders
ADD COLUMN IF NOT EXISTS system text;

-- Refresh PostgREST schema cache so client upserts can see the new column
NOTIFY pgrst, 'reload schema';
