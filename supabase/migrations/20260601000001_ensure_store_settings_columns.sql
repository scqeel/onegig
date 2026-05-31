-- Ensure agent_profiles columns exist
ALTER TABLE public.agent_profiles 
ADD COLUMN IF NOT EXISTS store_template_theme TEXT DEFAULT 'minimalist',
ADD COLUMN IF NOT EXISTS store_font_family TEXT DEFAULT 'Inter',
ADD COLUMN IF NOT EXISTS store_dark_mode BOOLEAN DEFAULT false;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
