-- Redefine handle_new_user trigger to resolve referred_by_code using either referral_code or store_slug
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ref_by UUID := NULL;
  new_ref_code TEXT;
  parent_ap_id UUID := NULL;
  meta_ref_code TEXT;
BEGIN
  -- Generate unique referral code
  new_ref_code := public.generate_referral_code(NEW.id);

  meta_ref_code := NEW.raw_user_meta_data->>'referred_by_code';

  -- Handle referred_by_code from metadata
  IF meta_ref_code IS NOT NULL AND meta_ref_code <> '' THEN
    -- 1. Try to find parent by referral_code in profiles
    SELECT id INTO ref_by FROM public.profiles WHERE referral_code = meta_ref_code LIMIT 1;
    
    -- 2. Fallback: try to find parent by store_slug in agent_profiles
    IF ref_by IS NULL THEN
      SELECT user_id INTO ref_by FROM public.agent_profiles WHERE store_slug = meta_ref_code LIMIT 1;
    END IF;
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
  
  INSERT INTO public.user_roles (user_id, role) 
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Create inactive agent profile if signing up with agent intent
  IF (NEW.raw_user_meta_data->>'intent' = 'agent') THEN
    IF ref_by IS NOT NULL THEN
      SELECT id INTO parent_ap_id FROM public.agent_profiles WHERE user_id = ref_by LIMIT 1;
    END IF;

    INSERT INTO public.agent_profiles (user_id, store_slug, store_name, activation_paid, parent_agent_id)
    VALUES (
      NEW.id,
      new_ref_code,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'My') || ' Store',
      false,
      parent_ap_id
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
