-- Add toggles for floating widgets
ALTER TABLE public.agent_profiles 
ADD COLUMN IF NOT EXISTS enable_ai_assistant BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_loyalty_rewards BOOLEAN DEFAULT true;
