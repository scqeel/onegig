-- Security Hardening Migration for OneGig / SwiftData
-- 1. Enable RLS on core tables
ALTER TABLE IF EXISTS public.saved_meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;

-- 2. Wallet Transactions RLS (Users can only view their own transaction history)
DROP POLICY IF EXISTS "Users can view own transactions" ON public.wallet_transactions;
CREATE POLICY "Users can view own transactions"
  ON public.wallet_transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 3. Withdrawals RLS (Users can only view their own withdrawals)
DROP POLICY IF EXISTS "Users can view own withdrawals" ON public.withdrawals;
CREATE POLICY "Users can view own withdrawals"
  ON public.withdrawals FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 4. Saved Meters RLS (Users can only manage their own saved meters)
DROP POLICY IF EXISTS "Users can manage their own saved meters" ON public.saved_meters;
CREATE POLICY "Users can manage their own saved meters"
  ON public.saved_meters FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- 5. Orders RLS (Users can view their own orders; Agents can view orders from their store)
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    customer_user_id = auth.uid()
    OR agent_id IN (SELECT id FROM public.agent_profiles WHERE user_id = auth.uid())
  );

-- 6. Payments RLS (Users can view their own payments)
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 7. App Settings RLS (Hide all sensitive API keys from public anon/authenticated queries)
DROP POLICY IF EXISTS "Public view settings" ON public.app_settings;
CREATE POLICY "Public view settings" ON public.app_settings
  FOR SELECT
  TO anon, authenticated
  USING (
    key NOT IN (
      'data_providers',
      'txtconnect_api_key',
      'theteller_api_key',
      'theteller_api_user',
      'paystack_secret_key',
      'developer_api_key'
    )
    AND key NOT LIKE 'crm_agent_%'
  );

-- 8. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
