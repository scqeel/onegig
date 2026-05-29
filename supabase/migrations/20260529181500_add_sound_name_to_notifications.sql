ALTER TABLE public.app_notifications 
ADD COLUMN IF NOT EXISTS sound_name TEXT NOT NULL DEFAULT 'default';
