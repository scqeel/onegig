-- Add parent_agent_id and parent_agent_profit to orders

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS parent_agent_id UUID REFERENCES public.agent_profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS parent_agent_profit NUMERIC NOT NULL DEFAULT 0;

-- Ensure RLS policies are updated so parent agents can see their own profits and orders
DROP POLICY IF EXISTS "Parent agents view their sub-agent orders" ON public.orders;
CREATE POLICY "Parent agents view their sub-agent orders" ON public.orders FOR SELECT TO authenticated
USING (parent_agent_id IN (SELECT id FROM public.agent_profiles WHERE user_id = auth.uid()));
