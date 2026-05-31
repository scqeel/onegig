-- Create storefront analytics table
CREATE TABLE IF NOT EXISTS public.storefront_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'page_view', 'checkout_initiated', 'payment_success'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.storefront_analytics ENABLE ROW LEVEL SECURITY;

-- Allow anonymous visitors to log events (Insert policy)
CREATE POLICY "Allow guest analytics inserts" 
    ON public.storefront_analytics FOR INSERT 
    TO anon, authenticated 
    WITH CHECK (true);

-- Allow storefront owners to read their own analytics
CREATE POLICY "Allow agent to view own storefront analytics" 
    ON public.storefront_analytics FOR SELECT 
    TO authenticated 
    USING (agent_id IN (SELECT id FROM public.agent_profiles WHERE user_id = auth.uid()));
