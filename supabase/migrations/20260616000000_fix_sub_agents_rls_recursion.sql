-- Create the sub_agent_wholesale_overrides table if it was skipped or not created
CREATE TABLE IF NOT EXISTS public.sub_agent_wholesale_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_agent_id UUID NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
    sub_agent_id UUID NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
    bundle_id UUID NOT NULL REFERENCES public.bundles(id) ON DELETE CASCADE,
    wholesale_price NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(sub_agent_id, bundle_id)
);

-- Enable RLS on the table
ALTER TABLE public.sub_agent_wholesale_overrides ENABLE ROW LEVEL SECURITY;

-- Grant permissions on the table
GRANT ALL ON public.sub_agent_wholesale_overrides TO postgres, anon, authenticated, service_role;

-- Helper function to fetch the agent profile ID of the currently logged-in user.
-- Marked as SECURITY DEFINER to bypass Row Level Security (RLS) policies on agent_profiles
-- and prevent infinite recursion when used within policies on the same table.
CREATE OR REPLACE FUNCTION public.get_my_agent_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.agent_profiles WHERE user_id = auth.uid();
$$;

-- Redefine agent_profiles RLS policies for sub-agents to use the helper function
DROP POLICY IF EXISTS "Parent agents can view their sub-agents" ON public.agent_profiles;
CREATE POLICY "Parent agents can view their sub-agents"
ON public.agent_profiles FOR SELECT 
TO authenticated
USING (parent_agent_id = public.get_my_agent_profile_id());

DROP POLICY IF EXISTS "Parent agents can manage their sub-agents" ON public.agent_profiles;
CREATE POLICY "Parent agents can manage their sub-agents"
ON public.agent_profiles FOR UPDATE 
TO authenticated
USING (parent_agent_id = public.get_my_agent_profile_id());

-- Add policy to profiles table so parent agents can view names and phone numbers of their sub-agents
DROP POLICY IF EXISTS "Parent agents can view sub-agent profiles" ON public.profiles;
CREATE POLICY "Parent agents can view sub-agent profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT user_id 
    FROM public.agent_profiles 
    WHERE parent_agent_id = public.get_my_agent_profile_id()
  )
);

-- Redefine agent_bundle_prices RLS policies for sub-agents to use the helper function
DROP POLICY IF EXISTS "Parent agents view sub-agent prices" ON public.agent_bundle_prices;
CREATE POLICY "Parent agents view sub-agent prices"
ON public.agent_bundle_prices FOR SELECT
TO authenticated
USING (agent_id IN (SELECT id FROM public.agent_profiles WHERE parent_agent_id = public.get_my_agent_profile_id()));

DROP POLICY IF EXISTS "Parent agents manage sub-agent prices" ON public.agent_bundle_prices;
CREATE POLICY "Parent agents manage sub-agent prices"
ON public.agent_bundle_prices FOR ALL
TO authenticated
USING (agent_id IN (SELECT id FROM public.agent_profiles WHERE parent_agent_id = public.get_my_agent_profile_id()))
WITH CHECK (agent_id IN (SELECT id FROM public.agent_profiles WHERE parent_agent_id = public.get_my_agent_profile_id()));

-- Redefine orders RLS policies for sub-agent orders to use the helper function
DROP POLICY IF EXISTS "Parent agents view sub-agent orders" ON public.orders;
CREATE POLICY "Parent agents view sub-agent orders"
ON public.orders FOR SELECT
TO authenticated
USING (parent_agent_id = public.get_my_agent_profile_id());

-- Redefine sub_agent_wholesale_overrides RLS policies for sub-agent overrides to use the helper function
DROP POLICY IF EXISTS "Allow parent agents to manage overrides for sub-agents" ON public.sub_agent_wholesale_overrides;
CREATE POLICY "Allow parent agents to manage overrides for sub-agents"
ON public.sub_agent_wholesale_overrides FOR ALL
TO authenticated
USING (parent_agent_id = public.get_my_agent_profile_id())
WITH CHECK (parent_agent_id = public.get_my_agent_profile_id());

DROP POLICY IF EXISTS "Allow sub-agents to view overrides applied to them" ON public.sub_agent_wholesale_overrides;
CREATE POLICY "Allow sub-agents to view overrides applied to them"
ON public.sub_agent_wholesale_overrides FOR SELECT
TO authenticated
USING (sub_agent_id = public.get_my_agent_profile_id());

-- Notify PGRST to reload the schema cache
NOTIFY pgrst, 'reload schema';
