-- Add new transaction types to the enum
ALTER TYPE public.wallet_tx_type ADD VALUE IF NOT EXISTS 'deposit';
ALTER TYPE public.wallet_tx_type ADD VALUE IF NOT EXISTS 'purchase';
ALTER TYPE public.wallet_tx_type ADD VALUE IF NOT EXISTS 'affiliate_commission';

-- Add wallet balance to profiles for customers
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Add referral tracking to agent profiles
ALTER TABLE public.agent_profiles ADD COLUMN IF NOT EXISTS referred_by_agent_id UUID REFERENCES public.agent_profiles(id) ON DELETE SET NULL;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
