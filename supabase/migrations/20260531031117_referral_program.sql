ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_referral_code_idx ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS profiles_referred_by_idx ON public.profiles(referred_by);

-- Create a function to generate a random referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code(user_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  base_code TEXT;
  new_code TEXT;
  is_unique BOOLEAN;
BEGIN
  -- Simple 6 char alphanumeric base
  base_code := upper(substring(replace(user_id::text, '-', ''), 1, 6));
  new_code := base_code;
  LOOP
    SELECT NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = new_code) INTO is_unique;
    EXIT WHEN is_unique;
    new_code := base_code || upper(substring(md5(random()::text), 1, 2));
  END LOOP;
  RETURN new_code;
END;
$$;

-- Modify handle_new_user to accept referred_by_code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ref_by UUID := NULL;
  new_ref_code TEXT;
BEGIN
  -- Generate unique referral code
  new_ref_code := public.generate_referral_code(NEW.id);

  -- Handle referred_by_code from metadata
  IF NEW.raw_user_meta_data->>'referred_by_code' IS NOT NULL THEN
    SELECT id INTO ref_by FROM public.profiles WHERE referral_code = NEW.raw_user_meta_data->>'referred_by_code' LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, phone, full_name, email, username, referral_code, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'username',
    new_ref_code,
    ref_by
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END; $$;

-- Backfill existing users
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE referral_code IS NULL LOOP
    UPDATE public.profiles SET referral_code = public.generate_referral_code(r.id) WHERE id = r.id;
  END LOOP;
END;
$$;

-- Force schema reload for PostgREST
NOTIFY pgrst, 'reload schema';
