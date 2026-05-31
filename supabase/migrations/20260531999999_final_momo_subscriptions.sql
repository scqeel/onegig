-- Create the table explicitly
CREATE TABLE IF NOT EXISTS public.momo_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
    bundle_id UUID REFERENCES public.bundles(id) ON DELETE CASCADE,
    recipient_phone TEXT NOT NULL,
    frequency TEXT NOT NULL, -- 'weekly', 'monthly'
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'paused', 'cancelled'
    next_billing_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grant privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON public.momo_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.momo_subscriptions TO anon;
GRANT ALL ON public.momo_subscriptions TO service_role;

-- Enable RLS
ALTER TABLE public.momo_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to recreate them cleanly
DROP POLICY IF EXISTS "Users can read/update own subscriptions" ON public.momo_subscriptions;
DROP POLICY IF EXISTS "Agents can manage storefront subscriptions" ON public.momo_subscriptions;
DROP POLICY IF EXISTS "Service role full access on subscriptions" ON public.momo_subscriptions;
DROP POLICY IF EXISTS "Admins manage subscriptions" ON public.momo_subscriptions;

-- Recreate Policies
CREATE POLICY "Users can read/update own subscriptions"
    ON public.momo_subscriptions FOR ALL
    TO authenticated, anon
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Agents can manage storefront subscriptions"
    ON public.momo_subscriptions FOR ALL
    TO authenticated
    USING (agent_id IN (SELECT id FROM public.agent_profiles WHERE user_id = auth.uid()))
    WITH CHECK (agent_id IN (SELECT id FROM public.agent_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Service role full access on subscriptions"
    ON public.momo_subscriptions FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Admins manage subscriptions"
    ON public.momo_subscriptions FOR ALL
    TO authenticated
    USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'))
    WITH CHECK (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- Force Schema reload
NOTIFY pgrst, 'reload schema';
