-- 1. Add theme columns to public.agent_profiles
ALTER TABLE public.agent_profiles 
ADD COLUMN IF NOT EXISTS store_template_theme TEXT DEFAULT 'minimalist',
ADD COLUMN IF NOT EXISTS store_font_family TEXT DEFAULT 'Inter',
ADD COLUMN IF NOT EXISTS store_dark_mode BOOLEAN DEFAULT false;

-- 2. Create loyalty points table
CREATE TABLE IF NOT EXISTS public.loyalty_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
    points_balance INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, agent_id)
);

-- Enable RLS for loyalty_points
ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

-- Allow select/read to authenticated/anon users for their own points
DROP POLICY IF EXISTS "Users can read own loyalty points" ON public.loyalty_points;
CREATE POLICY "Users can read own loyalty points"
    ON public.loyalty_points FOR SELECT
    TO authenticated, anon
    USING (user_id = auth.uid());

-- Allow admins/agents to manage points
DROP POLICY IF EXISTS "Admins and service role full control on loyalty points" ON public.loyalty_points;
CREATE POLICY "Admins and service role full control on loyalty points"
    ON public.loyalty_points FOR ALL
    TO service_role, authenticated
    USING (
        auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin')
        OR agent_id IN (SELECT id FROM public.agent_profiles WHERE user_id = auth.uid())
    )
    WITH CHECK (
        auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin')
        OR agent_id IN (SELECT id FROM public.agent_profiles WHERE user_id = auth.uid())
    );

-- 3. Create momo subscriptions table
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

-- Enable RLS for momo_subscriptions
ALTER TABLE public.momo_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow select/read/update to authenticated/anon users for their own subscriptions
DROP POLICY IF EXISTS "Users can read/update own subscriptions" ON public.momo_subscriptions;
CREATE POLICY "Users can read/update own subscriptions"
    ON public.momo_subscriptions FOR ALL
    TO authenticated, anon
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Allow agents full access on their storefront subscriptions
DROP POLICY IF EXISTS "Agents can manage storefront subscriptions" ON public.momo_subscriptions;
CREATE POLICY "Agents can manage storefront subscriptions"
    ON public.momo_subscriptions FOR ALL
    TO authenticated
    USING (agent_id IN (SELECT id FROM public.agent_profiles WHERE user_id = auth.uid()))
    WITH CHECK (agent_id IN (SELECT id FROM public.agent_profiles WHERE user_id = auth.uid()));

-- Allow service role full access
DROP POLICY IF EXISTS "Service role full access on subscriptions" ON public.momo_subscriptions;
CREATE POLICY "Service role full access on subscriptions"
    ON public.momo_subscriptions FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
