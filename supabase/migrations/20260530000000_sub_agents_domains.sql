-- Add custom_domain and parent_agent_id to agent_profiles
ALTER TABLE public.agent_profiles 
ADD COLUMN IF NOT EXISTS custom_domain TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS parent_agent_id UUID REFERENCES public.agent_profiles(id) ON DELETE SET NULL;

-- RLS for sub-agents: Parent agent can view their sub-agents
DROP POLICY IF EXISTS "Parent agents can view their sub-agents" ON public.agent_profiles;
CREATE POLICY "Parent agents can view their sub-agents"
ON public.agent_profiles FOR SELECT 
TO authenticated
USING (parent_agent_id IN (SELECT id FROM public.agent_profiles WHERE user_id = auth.uid()));

-- Parent agent can manage (update) their sub-agents
DROP POLICY IF EXISTS "Parent agents can manage their sub-agents" ON public.agent_profiles;
CREATE POLICY "Parent agents can manage their sub-agents"
ON public.agent_profiles FOR UPDATE 
TO authenticated
USING (parent_agent_id IN (SELECT id FROM public.agent_profiles WHERE user_id = auth.uid()));

-- Sub-agent orders and pricing access for parent agent
-- Note: Sub-agents' agent_id is their own id.
-- Parent agents should be able to view agent_bundle_prices where the agent is their sub-agent
DROP POLICY IF EXISTS "Parent agents view sub-agent prices" ON public.agent_bundle_prices;
CREATE POLICY "Parent agents view sub-agent prices"
ON public.agent_bundle_prices FOR SELECT
TO authenticated
USING (agent_id IN (SELECT id FROM public.agent_profiles WHERE parent_agent_id IN (SELECT id FROM public.agent_profiles WHERE user_id = auth.uid())));

-- Parent agents can manage sub-agent prices
DROP POLICY IF EXISTS "Parent agents manage sub-agent prices" ON public.agent_bundle_prices;
CREATE POLICY "Parent agents manage sub-agent prices"
ON public.agent_bundle_prices FOR ALL
TO authenticated
USING (agent_id IN (SELECT id FROM public.agent_profiles WHERE parent_agent_id IN (SELECT id FROM public.agent_profiles WHERE user_id = auth.uid())))
WITH CHECK (agent_id IN (SELECT id FROM public.agent_profiles WHERE parent_agent_id IN (SELECT id FROM public.agent_profiles WHERE user_id = auth.uid())));

-- Update the app roles ENUM to include 'sub_agent' if not already (Actually, we don't strictly need a 'sub_agent' role since they are just 'agent's with a parent_agent_id). So we leave app_role as is.
