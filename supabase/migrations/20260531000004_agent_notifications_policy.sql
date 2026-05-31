-- Allow agents to send notifications to their storefront customers
DROP POLICY IF EXISTS "Allow agents to send notifications to their storefront customers" ON public.app_notifications;
CREATE POLICY "Allow agents to send notifications to their storefront customers"
    ON public.app_notifications FOR INSERT
    TO authenticated
    WITH CHECK (
        is_global = false
        AND target_user_id IN (
            SELECT customer_user_id 
            FROM public.orders 
            WHERE agent_id IN (
                SELECT id 
                FROM public.agent_profiles 
                WHERE user_id = auth.uid()
            )
            AND customer_user_id IS NOT NULL
        )
    );
