CREATE OR REPLACE FUNCTION public.get_wallet_balance(_user_id UUID)
RETURNS NUMERIC LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN type::text IN ('earning','refund','adjustment','deposit') AND status::text = 'completed' THEN amount
      WHEN type::text IN ('withdrawal','purchase','activation_fee') AND status::text IN ('pending','completed') THEN -amount
      ELSE 0
    END
  ), 0)
  FROM public.wallet_transactions
  WHERE user_id = _user_id;
$$;

UPDATE public.profiles p
SET wallet_balance = public.get_wallet_balance(p.id);
