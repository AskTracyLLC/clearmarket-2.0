-- Drop the hard-coded category CHECK constraint since categories are now data-driven
ALTER TABLE public.inspection_type_options 
DROP CONSTRAINT inspection_type_options_category_check;