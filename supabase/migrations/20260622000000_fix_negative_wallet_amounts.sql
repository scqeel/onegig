-- Correct existing negative amounts in wallet transactions to be positive
UPDATE public.wallet_transactions
SET amount = abs(amount)
WHERE amount < 0;

-- Recreate get_wallet_balance to be defensive using abs(amount)
CREATE OR REPLACE FUNCTION public.get_wallet_balance(_user_id UUID)
RETURNS NUMERIC LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN type::text IN ('earning','refund','adjustment','deposit') AND status::text = 'completed' THEN abs(amount)
      WHEN type::text IN ('withdrawal','purchase','activation_fee') AND status::text IN ('pending','completed') THEN -abs(amount)
      ELSE 0
    END
  ), 0)
  FROM public.wallet_transactions
  WHERE user_id = _user_id;
$$;

-- Recalculate profiles' wallet balance
UPDATE public.profiles p
SET wallet_balance = public.get_wallet_balance(p.id);

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
