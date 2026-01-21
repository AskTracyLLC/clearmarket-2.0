BEGIN;

-- Add Est. Completion (ECT) column to clearcheck_orders
ALTER TABLE public.clearcheck_orders
ADD COLUMN ect date;

COMMENT ON COLUMN public.clearcheck_orders.ect IS 'Estimated Completion Time/Date';

COMMIT;