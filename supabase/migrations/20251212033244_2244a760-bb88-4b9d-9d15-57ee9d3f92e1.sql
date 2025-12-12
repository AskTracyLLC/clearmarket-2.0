-- Create table for user table column preferences
CREATE TABLE public.user_table_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  table_key TEXT NOT NULL,
  visible_columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, table_key)
);

-- Enable RLS
ALTER TABLE public.user_table_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read their own preferences
CREATE POLICY "Users can view their own table preferences"
ON public.user_table_preferences
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert their own table preferences"
ON public.user_table_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update their own table preferences"
ON public.user_table_preferences
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own preferences
CREATE POLICY "Users can delete their own table preferences"
ON public.user_table_preferences
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_user_table_preferences_updated_at
BEFORE UPDATE ON public.user_table_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();