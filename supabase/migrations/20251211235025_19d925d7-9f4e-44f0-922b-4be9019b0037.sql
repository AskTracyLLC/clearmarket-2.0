-- Seed vendor_match_assistant feature flag
INSERT INTO public.feature_flags (key, name, description, is_enabled, is_paid, beta_note)
VALUES (
  'vendor_match_assistant',
  'Vendor Match Assistant',
  'Shows vendors when their Seeking Coverage posts are priced below available rep rates in that area.',
  true,
  true,
  'Free during testing. This will become a paid feature after launch.'
)
ON CONFLICT (key) DO NOTHING;