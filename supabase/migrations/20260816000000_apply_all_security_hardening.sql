-- Security Hardening Migration for OneGig / SwiftData
-- 1. Enable RLS on core tables
ALTER TABLE IF EXISTS public.saved_meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;

-- 2. Wallet Transactions RLS (Users view own transactions; Admins view all)
DROP POLICY IF EXISTS "Users can view own transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Users and admins can view wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Users and admins can view wallet transactions"
  ON public.wallet_transactions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- 3. Withdrawals RLS (Users view own withdrawals; Admins view all)
DROP POLICY IF EXISTS "Users can view own withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Users and admins can view withdrawals" ON public.withdrawals;
CREATE POLICY "Users and admins can view withdrawals"
  ON public.withdrawals FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- 4. Saved Meters RLS (Users manage own meters; Admins view all)
DROP POLICY IF EXISTS "Users can manage their own saved meters" ON public.saved_meters;
DROP POLICY IF EXISTS "Users and admins can view saved meters" ON public.saved_meters;
CREATE POLICY "Users and admins can view saved meters"
  ON public.saved_meters FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- 5. Orders RLS (Users view own orders; Agents view store orders; Admins view ALL orders)
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Users and admins can view orders" ON public.orders;
CREATE POLICY "Users and admins can view orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    customer_user_id = auth.uid()
    OR agent_id IN (SELECT id FROM public.agent_profiles WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- 6. Payments RLS (Users view own payments; Admins view ALL payments)
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Users and admins can view payments" ON public.payments;
CREATE POLICY "Users and admins can view payments"
  ON public.payments FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- 7. App Settings RLS (Hide all sensitive API keys from public queries)
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
