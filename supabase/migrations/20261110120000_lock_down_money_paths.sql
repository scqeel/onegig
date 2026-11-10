-- Closes direct database paths that could create money or bypass checks made in Edge Functions.
-- Orders, withdrawals and agent activation are now created only by server code.
BEGIN;

-- 1. Remove direct creation of records that must go through server checks.
--    An anonymous order marked as paid credited agent commission through
--    trg_auto_distribute_commissions.
DROP POLICY IF EXISTS "Anyone create orders" ON public.orders;
DROP POLICY IF EXISTS "Users create own withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Agents insert own profile" ON public.agent_profiles;

REVOKE INSERT ON public.orders, public.withdrawals, public.agent_profiles FROM anon, authenticated;

-- 2. Anonymous visitors never write to these tables directly, and TRUNCATE ignores row level security.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'orders', 'payments', 'wallet_transactions', 'withdrawals', 'profiles', 'user_roles',
    'coupons', 'agent_profiles', 'agent_bundle_prices', 'app_settings', 'momo_subscriptions',
    'loyalty_points', 'sub_agent_wholesale_overrides', 'bundles', 'networks'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon', t);
      EXECUTE format('REVOKE TRUNCATE ON public.%I FROM authenticated', t);
    END IF;
  END LOOP;
END $$;

-- 3. Internal functions run with full privileges, so callers must not reach them directly.
--    Matched by name so this also covers any version that differs from the repo.
DO $$
DECLARE
  f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('increment_wallet_balance', 'distribute_order_commissions', 'generate_referral_code')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;

  -- Signed-in users check their own balance. Guests have no balance to read.
  FOR f IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_wallet_balance'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- 4. Row policies let users edit their own row, but not every column in it is theirs to change.
--    SECURITY INVOKER is deliberate: current_user must be the caller's role, so server code and
--    trusted database functions pass while requests from browsers are checked.
CREATE OR REPLACE FUNCTION public.guard_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  i int;
  old_row jsonb := to_jsonb(OLD);
  new_row jsonb := to_jsonb(NEW);
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  FOR i IN 0 .. TG_NARGS - 1 LOOP
    IF (old_row -> TG_ARGV[i]) IS DISTINCT FROM (new_row -> TG_ARGV[i]) THEN
      RAISE EXCEPTION 'Changing % is not allowed', TG_ARGV[i] USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profiles_protected_columns ON public.profiles;
CREATE TRIGGER guard_profiles_protected_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_protected_columns('wallet_balance', 'referral_code', 'referred_by');

DROP TRIGGER IF EXISTS guard_agent_profiles_protected_columns ON public.agent_profiles;
CREATE TRIGGER guard_agent_profiles_protected_columns
  BEFORE UPDATE ON public.agent_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_protected_columns(
    'user_id', 'activation_paid', 'activation_paid_at', 'parent_agent_id', 'referred_by_agent_id', 'agent_tier'
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
