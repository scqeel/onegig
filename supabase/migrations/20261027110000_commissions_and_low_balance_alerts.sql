-- Migration: 20261027110000_commissions_and_low_balance_alerts.sql
-- Description: Centralized atomic commission distribution engine and trigger for OneGig

CREATE OR REPLACE FUNCTION public.distribute_order_commissions(p_order_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_agent_profile RECORD;
  v_parent_profile RECORD;
  v_existing_direct RECORD;
  v_existing_override RECORD;
BEGIN
  -- 1. Fetch order details
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- 2. Only distribute on paid orders in delivered or processing state
  IF v_order.payment_status != 'paid' OR v_order.status NOT IN ('delivered', 'processing') THEN
    RETURN;
  END IF;

  IF v_order.agent_id IS NULL THEN
    RETURN;
  END IF;

  -- 3. Fetch direct agent profile
  SELECT * INTO v_agent_profile FROM public.agent_profiles WHERE id = v_order.agent_id;
  IF NOT FOUND OR v_agent_profile.user_id IS NULL THEN
    RETURN;
  END IF;

  -- 4. Credit Direct Agent Profit (Idempotent check)
  IF COALESCE(v_order.agent_profit, 0) > 0 THEN
    SELECT id INTO v_existing_direct FROM public.wallet_transactions 
    WHERE related_order_id = v_order.id AND user_id = v_agent_profile.user_id AND type = 'earning'
    LIMIT 1;

    IF v_existing_direct.id IS NULL THEN
      INSERT INTO public.wallet_transactions (
        user_id,
        type,
        amount,
        status,
        related_order_id,
        description
      ) VALUES (
        v_agent_profile.user_id,
        'earning',
        v_order.agent_profit,
        'completed',
        v_order.id,
        'Profit from order ' || COALESCE(v_order.reference, v_order.id::text)
      );

      -- In-app notification
      INSERT INTO public.app_notifications (
        title,
        message,
        type,
        sound_name,
        target_user_id,
        is_global
      ) VALUES (
        'New Store Sale! 🎉',
        'You earned GHS ' || TO_CHAR(v_order.agent_profit, 'FM999,990.00') || ' profit from a sale to ' || COALESCE(v_order.recipient_phone, 'customer') || '.',
        'success',
        'paystack',
        v_agent_profile.user_id,
        false
      );
    END IF;
  END IF;

  -- 5. Credit Parent Agent Overriding Profit (Idempotent check)
  IF COALESCE(v_order.parent_agent_profit, 0) > 0 AND v_agent_profile.parent_agent_id IS NOT NULL THEN
    SELECT * INTO v_parent_profile FROM public.agent_profiles WHERE id = v_agent_profile.parent_agent_id;
    IF FOUND AND v_parent_profile.user_id IS NOT NULL THEN
      SELECT id INTO v_existing_override FROM public.wallet_transactions 
      WHERE related_order_id = v_order.id AND user_id = v_parent_profile.user_id AND type = 'earning'
      LIMIT 1;

      IF v_existing_override.id IS NULL THEN
        INSERT INTO public.wallet_transactions (
          user_id,
          type,
          amount,
          status,
          related_order_id,
          description
        ) VALUES (
          v_parent_profile.user_id,
          'earning',
          v_order.parent_agent_profit,
          'completed',
          v_order.id,
          'Sub-agent override bonus from ' || COALESCE(v_agent_profile.business_name, 'sub-agent') || ' (Order ' || COALESCE(v_order.reference, v_order.id::text) || ')'
        );

        INSERT INTO public.app_notifications (
          title,
          message,
          type,
          sound_name,
          target_user_id,
          is_global
        ) VALUES (
          'Sub-Agent Commission! 🚀',
          'You earned GHS ' || TO_CHAR(v_order.parent_agent_profit, 'FM999,990.00') || ' override profit from ' || COALESCE(v_agent_profile.business_name, 'your sub-agent') || '.',
          'success',
          'paystack',
          v_parent_profile.user_id,
          false
        );
      END IF;
    END IF;
  END IF;

END;
$$;

-- Trigger to auto-invoke distribute_order_commissions on order completion/payment
CREATE OR REPLACE FUNCTION public.fn_trigger_order_commissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND NEW.status IN ('delivered', 'processing') THEN
    PERFORM public.distribute_order_commissions(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_distribute_commissions ON public.orders;
CREATE TRIGGER trg_auto_distribute_commissions
AFTER INSERT OR UPDATE OF status, payment_status
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.fn_trigger_order_commissions();
