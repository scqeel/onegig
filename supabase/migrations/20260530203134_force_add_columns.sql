-- Force add columns that might have been skipped
ALTER TABLE public.agent_profiles 
ADD COLUMN IF NOT EXISTS custom_domain TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS parent_agent_id UUID REFERENCES public.agent_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS parent_agent_id UUID REFERENCES public.agent_profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS parent_agent_profit NUMERIC NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';
