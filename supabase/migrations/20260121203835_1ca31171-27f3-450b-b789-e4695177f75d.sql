-- Add job_name and start_date columns to clearcheck_orders
ALTER TABLE public.clearcheck_orders ADD COLUMN job_name text;
ALTER TABLE public.clearcheck_orders ADD COLUMN start_date date;

COMMENT ON COLUMN public.clearcheck_orders.job_name IS 'Job name/title from the order';
COMMENT ON COLUMN public.clearcheck_orders.start_date IS 'Start date for the order';