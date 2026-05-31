-- Ensure promo banner columns exist
ALTER TABLE public.agent_profiles 
ADD COLUMN IF NOT EXISTS store_promo_banner TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS store_promo_banner_style TEXT DEFAULT 'neon-flash';

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
