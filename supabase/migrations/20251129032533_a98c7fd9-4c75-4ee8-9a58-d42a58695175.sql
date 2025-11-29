-- Add Access & Equipment columns to rep_profile table

ALTER TABLE public.rep_profile
ADD COLUMN IF NOT EXISTS has_hud_keys boolean,
ADD COLUMN IF NOT EXISTS hud_keys_details text,
ADD COLUMN IF NOT EXISTS equipment_notes text;

COMMENT ON COLUMN public.rep_profile.has_hud_keys IS 'Whether this rep has any HUD keys / similar property access keys';
COMMENT ON COLUMN public.rep_profile.hud_keys_details IS 'Free-text description of which HUD keys / access keys the rep has (e.g., HUD, REO, combo boxes, etc.)';
COMMENT ON COLUMN public.rep_profile.equipment_notes IS 'Optional free-text list of tools/equipment the rep has available';