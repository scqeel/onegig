-- Create coupons table
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    agent_id UUID REFERENCES public.agent_profiles(id) ON DELETE CASCADE DEFAULT NULL, -- NULL means global admin coupon
    active BOOLEAN DEFAULT true,
    max_uses INT DEFAULT 100,
    current_uses INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Allow guest storefront checkout validation (Select policy for anyone)
CREATE POLICY "Allow select active coupons"
    ON public.coupons FOR SELECT
    TO anon, authenticated
    USING (active = true);

-- Allow admins full control
CREATE POLICY "Allow admin full access on coupons"
    ON public.coupons FOR ALL
    TO authenticated
    USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'))
    WITH CHECK (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- Allow agents to manage their own coupons
CREATE POLICY "Allow agent to manage own coupons"
    ON public.coupons FOR ALL
    TO authenticated
    USING (agent_id IN (SELECT id FROM public.agent_profiles WHERE user_id = auth.uid()))
    WITH CHECK (agent_id IN (SELECT id FROM public.agent_profiles WHERE user_id = auth.uid()));
