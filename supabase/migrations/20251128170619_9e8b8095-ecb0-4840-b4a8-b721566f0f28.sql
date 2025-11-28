-- 1) Connection notes table
CREATE TABLE IF NOT EXISTS public.connection_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  vendor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rep_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Which side this note belongs to: 'vendor' = vendor's private notes, 'rep' = rep's private notes
  side text NOT NULL CHECK (side IN ('vendor', 'rep')),

  note text NOT NULL
);

COMMENT ON TABLE public.connection_notes IS 'Private CRM-style notes per vendor/rep connection. Each side has its own notes.';
COMMENT ON COLUMN public.connection_notes.vendor_id IS 'Vendor user_id from profiles';
COMMENT ON COLUMN public.connection_notes.rep_id IS 'Rep user_id from profiles';
COMMENT ON COLUMN public.connection_notes.side IS 'Which side this note belongs to: vendor or rep';
COMMENT ON COLUMN public.connection_notes.note IS 'Internal note text (private to that side)';

-- 2) updated_at trigger
CREATE TRIGGER update_connection_notes_updated_at
  BEFORE UPDATE ON public.connection_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Enable RLS
ALTER TABLE public.connection_notes ENABLE ROW LEVEL SECURITY;

-- 4) RLS policies
-- Vendors can only see/write notes where side='vendor' and they are the vendor
CREATE POLICY "Vendors can read own connection notes"
ON public.connection_notes
FOR SELECT
TO authenticated
USING (
  side = 'vendor' AND auth.uid() = vendor_id
);

CREATE POLICY "Vendors can insert own connection notes"
ON public.connection_notes
FOR INSERT
TO authenticated
WITH CHECK (
  side = 'vendor' AND auth.uid() = vendor_id AND auth.uid() = author_id
);

-- Reps can only see/write notes where side='rep' and they are the rep
CREATE POLICY "Reps can read own connection notes"
ON public.connection_notes
FOR SELECT
TO authenticated
USING (
  side = 'rep' AND auth.uid() = rep_id
);

CREATE POLICY "Reps can insert own connection notes"
ON public.connection_notes
FOR INSERT
TO authenticated
WITH CHECK (
  side = 'rep' AND auth.uid() = rep_id AND auth.uid() = author_id
);