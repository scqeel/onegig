-- Create sub-agent wholesale base price overrides table
CREATE TABLE IF NOT EXISTS public.sub_agent_wholesale_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_agent_id UUID NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
    sub_agent_id UUID NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
    bundle_id UUID NOT NULL REFERENCES public.bundles(id) ON DELETE CASCADE,
    wholesale_price NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(sub_agent_id, bundle_id)
);

-- Enable RLS
ALTER TABLE public.sub_agent_wholesale_overrides ENABLE ROW LEVEL SECURITY;

-- Allow parent agents to view and manage overrides for their sub-agents
CREATE POLICY "Allow parent agents to manage overrides for sub-agents"
    ON public.sub_agent_wholesale_overrides FOR ALL
    TO authenticated
    USING (parent_agent_id IN (SELECT id FROM public.agent_profiles WHERE user_id = auth.uid()))
    WITH CHECK (parent_agent_id IN (SELECT id FROM public.agent_profiles WHERE user_id = auth.uid()));

-- Allow sub-agents to read overrides applied to them
CREATE POLICY "Allow sub-agents to view overrides applied to them"
    ON public.sub_agent_wholesale_overrides FOR SELECT
    TO authenticated
    USING (sub_agent_id IN (SELECT id FROM public.agent_profiles WHERE user_id = auth.uid()));
