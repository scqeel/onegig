ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_notification_check TIMESTAMPTZ DEFAULT NOW() - INTERVAL '1 day';

-- Force schema reload for PostgREST
NOTIFY pgrst, 'reload schema';
