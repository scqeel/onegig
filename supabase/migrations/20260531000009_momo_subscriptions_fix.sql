-- Ensure the table exists
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

-- Grant privileges so PostgREST exposes the table to the API
GRANT SELECT, INSERT, UPDATE, DELETE ON public.momo_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.momo_subscriptions TO anon;
GRANT ALL ON public.momo_subscriptions TO service_role;

-- Enable RLS
ALTER TABLE public.momo_subscriptions ENABLE ROW LEVEL SECURITY;

-- Add policy for admins
DROP POLICY IF EXISTS "Admins manage subscriptions" ON public.momo_subscriptions;
CREATE POLICY "Admins manage subscriptions"
    ON public.momo_subscriptions FOR ALL
    TO authenticated
    USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'))
    WITH CHECK (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- Force schema reload for PostgREST
NOTIFY pgrst, 'reload schema';
