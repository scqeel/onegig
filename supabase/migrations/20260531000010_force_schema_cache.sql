-- Force DDL change to trigger Supabase's internal schema watcher
ALTER TABLE public.momo_subscriptions ADD COLUMN IF NOT EXISTS _force_reload BOOLEAN;
ALTER TABLE public.momo_subscriptions DROP COLUMN _force_reload;

-- Send both NOTIFY commands
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
