CREATE TABLE IF NOT EXISTS public.user_hidden_notifications (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    notification_id UUID REFERENCES public.app_notifications(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, notification_id)
);

ALTER TABLE public.user_hidden_notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own hidden notifications
CREATE POLICY "Users can read their own hidden notifications"
    ON public.user_hidden_notifications FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Users can insert their own hidden notifications
CREATE POLICY "Users can hide notifications"
    ON public.user_hidden_notifications FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Allow users to delete their OWN non-global notifications from the main table to save space
DROP POLICY IF EXISTS "Users can delete their own direct notifications" ON public.app_notifications;
CREATE POLICY "Users can delete their own direct notifications"
    ON public.app_notifications FOR DELETE
    TO authenticated
    USING (target_user_id = auth.uid() AND is_global = false);

-- Reload schema
NOTIFY pgrst, 'reload schema';
