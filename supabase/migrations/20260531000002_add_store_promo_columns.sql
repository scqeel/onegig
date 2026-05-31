-- Add promotional alert banner columns to agent profiles table
ALTER TABLE public.agent_profiles 
ADD COLUMN IF NOT EXISTS store_promo_banner TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS store_promo_banner_style TEXT DEFAULT 'neon-flash';
