CREATE OR REPLACE FUNCTION public.get_recent_payments_debug()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'payments', (
            SELECT json_agg(p) FROM (
                SELECT id, reference, user_id, purpose, amount, status, payload, created_at
                FROM public.payments
                ORDER BY created_at DESC
                LIMIT 20
            ) p
        ),
        'transactions', (
            SELECT json_agg(t) FROM (
                SELECT id, user_id, type, amount, status, description, created_at
                FROM public.wallet_transactions
                ORDER BY created_at DESC
                LIMIT 20
            ) t
        )
    ) INTO result;
    
    RETURN result;
END;
$$;
