CREATE TABLE IF NOT EXISTS public.app_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    target_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_global BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read global notifications or notifications meant for them
DROP POLICY IF EXISTS "Users can read their own or global notifications" ON public.app_notifications;
CREATE POLICY "Users can read their own or global notifications"
    ON public.app_notifications FOR SELECT
    TO authenticated, anon
    USING (is_global = true OR target_user_id = auth.uid());

-- Allow the system/admins to insert or update (we'll keep it simple: authenticated users can't write, only service_role can)
-- If we want admins to write via UI later, we can add a policy for that.
DROP POLICY IF EXISTS "Service role only for insert/update/delete" ON public.app_notifications;
CREATE POLICY "Service role only for insert/update/delete"
    ON public.app_notifications FOR ALL
    TO service_role
    USING (true);

-- Enable Realtime for app_notifications
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'app_notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.app_notifications;
    END IF;
END
$$;
