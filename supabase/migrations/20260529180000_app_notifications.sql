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
CREATE POLICY "Users can read their own or global notifications"
    ON public.app_notifications FOR SELECT
    TO authenticated, anon
    USING (is_global = true OR target_user_id = auth.uid());

-- Only admins can insert/update/delete notifications
CREATE POLICY "Admins can manage notifications"
    ON public.app_notifications FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

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
