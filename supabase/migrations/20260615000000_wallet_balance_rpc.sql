CREATE OR REPLACE FUNCTION public.increment_wallet_balance(user_id_param UUID, amount_param NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_balance NUMERIC;
BEGIN
    UPDATE public.profiles
    SET wallet_balance = wallet_balance + amount_param
    WHERE id = user_id_param
    RETURNING wallet_balance INTO new_balance;
    
    RETURN new_balance;
END;
$$;
