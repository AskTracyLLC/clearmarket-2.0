-- ClearMarket 2.0 Database Schema
-- User profiles extending auth.users with role flags
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Role flags (users can have multiple roles)
  is_fieldrep BOOLEAN NOT NULL DEFAULT false,
  is_vendor_admin BOOLEAN NOT NULL DEFAULT false,
  is_vendor_staff BOOLEAN NOT NULL DEFAULT false,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  is_moderator BOOLEAN NOT NULL DEFAULT false,
  is_support BOOLEAN NOT NULL DEFAULT false,
  
  -- Terms acceptance
  has_signed_terms BOOLEAN NOT NULL DEFAULT false,
  terms_signed_at TIMESTAMPTZ,
  terms_version TEXT
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Field Rep profiles
CREATE TABLE IF NOT EXISTS public.rep_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  business_name TEXT,
  coverage_areas TEXT[],
  systems_used TEXT[],
  bio TEXT,
  certifications TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rep_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rep profiles are viewable by authenticated users"
  ON public.rep_profile FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage their own rep profile"
  ON public.rep_profile FOR ALL
  USING (auth.uid() = user_id);

-- Vendor profiles
CREATE TABLE IF NOT EXISTS public.vendor_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  company_name TEXT NOT NULL,
  company_description TEXT,
  website TEXT,
  regions_covered TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendor profiles are viewable by authenticated users"
  ON public.vendor_profile FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage their own vendor profile"
  ON public.vendor_profile FOR ALL
  USING (auth.uid() = user_id);

-- Documents table (for signed NDAs/TOS and other documents)
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- 'nda_tos', 'certification', etc.
  title TEXT NOT NULL,
  signed_name TEXT,
  signature_timestamp TIMESTAMPTZ,
  storage_path TEXT, -- Path to file in Supabase Storage
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own documents"
  ON public.documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own documents"
  ON public.documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Seeking Coverage posts
CREATE TABLE IF NOT EXISTS public.seeking_coverage_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  inspection_type TEXT,
  systems_required TEXT[],
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'filled', 'expired'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

ALTER TABLE public.seeking_coverage_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view active seeking coverage posts"
  ON public.seeking_coverage_posts FOR SELECT
  TO authenticated
  USING (status = 'active');

CREATE POLICY "Vendors can manage their own posts"
  ON public.seeking_coverage_posts FOR ALL
  USING (auth.uid() = vendor_id);

-- Messages table (basic chat)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages"
  ON public.messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Recipients can update read status"
  ON public.messages FOR UPDATE
  USING (auth.uid() = recipient_id);

-- User wallet (credit system)
CREATE TABLE IF NOT EXISTS public.user_wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_wallet ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own wallet"
  ON public.user_wallet FOR SELECT
  USING (auth.uid() = user_id);

-- Trigger to create wallet on profile creation
CREATE OR REPLACE FUNCTION public.handle_new_profile_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_wallet (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_wallet
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile_wallet();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rep_profile_updated_at
  BEFORE UPDATE ON public.rep_profile
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendor_profile_updated_at
  BEFORE UPDATE ON public.vendor_profile
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_seeking_coverage_posts_updated_at
  BEFORE UPDATE ON public.seeking_coverage_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_wallet_updated_at
  BEFORE UPDATE ON public.user_wallet
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();