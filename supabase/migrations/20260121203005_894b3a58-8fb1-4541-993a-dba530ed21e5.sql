-- Add form column to clearcheck_orders
ALTER TABLE public.clearcheck_orders ADD COLUMN form text;

COMMENT ON COLUMN public.clearcheck_orders.form IS 'Form type/name for the order';