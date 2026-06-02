-- 1. Backfill parent_agent_id for existing agent profiles based on referral relationship in profiles table
UPDATE public.agent_profiles ap
SET parent_agent_id = parent_ap.id
FROM public.profiles p
JOIN public.agent_profiles parent_ap ON parent_ap.user_id = p.referred_by
WHERE ap.user_id = p.id
  AND ap.parent_agent_id IS NULL
  AND p.referred_by IS NOT NULL;

-- 2. Redefine RLS policy on profiles so parent agents can view profiles of their referred sub-agents directly
DROP POLICY IF EXISTS "Parent agents can view sub-agent profiles" ON public.profiles;
CREATE POLICY "Parent agents can view sub-agent profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  referred_by = auth.uid()
);

-- 3. Redefine "Public can view profiles" to allow authenticated users to view profiles (resolves parent referral code lookup during authenticated sessions)
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
CREATE POLICY "Public can view profiles" 
ON public.profiles FOR SELECT 
TO authenticated, anon 
USING (true);

-- 4. Update handle_new_user() trigger to automatically provision an inactive agent profile on agent-intent signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ref_by UUID := NULL;
  new_ref_code TEXT;
  parent_ap_id UUID := NULL;
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

-- 5. Create helper trigger to sync parent_agent_id from profiles.referred_by if it's missing on insert/update of agent_profiles
CREATE OR REPLACE FUNCTION public.sync_agent_parent_id()
RETURNS TRIGGER AS $$
DECLARE
  ref_by_user_id UUID;
  parent_ap_id UUID;
BEGIN
  IF NEW.parent_agent_id IS NULL THEN
    SELECT referred_by INTO ref_by_user_id FROM public.profiles WHERE id = NEW.user_id;
    
    IF ref_by_user_id IS NOT NULL THEN
      SELECT id INTO parent_ap_id FROM public.agent_profiles WHERE user_id = ref_by_user_id;
      
      IF parent_ap_id IS NOT NULL THEN
        NEW.parent_agent_id := parent_ap_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_agent_parent_id ON public.agent_profiles;
CREATE TRIGGER trg_sync_agent_parent_id
  BEFORE INSERT OR UPDATE OF parent_agent_id ON public.agent_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_agent_parent_id();

-- 6. Force schema reload for PostgREST
NOTIFY pgrst, 'reload schema';
