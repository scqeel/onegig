CREATE OR REPLACE FUNCTION public.reward_referrer_on_first_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ref_by UUID;
  order_count INT;
  reward_amount NUMERIC := 1.00;
  already_rewarded BOOLEAN;
BEGIN
  -- Only care about successful deliveries
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    
    -- Does the user have a referrer?
    SELECT referred_by INTO ref_by FROM public.profiles WHERE id = NEW.customer_user_id;
    
    IF ref_by IS NOT NULL THEN
      -- Check if this is their very first delivered order
      SELECT count(*) INTO order_count FROM public.orders WHERE customer_user_id = NEW.customer_user_id AND status = 'delivered';
      
      -- order_count includes the current NEW row, so it should be exactly 1
      IF order_count = 1 THEN
        -- Check if we already rewarded for this user to be safe
        SELECT EXISTS(SELECT 1 FROM public.wallet_transactions WHERE user_id = ref_by AND type = 'earning' AND description = 'Referral Bonus: ' || NEW.customer_user_id) INTO already_rewarded;
        
        IF NOT already_rewarded THEN
          -- Credit the referrer
          INSERT INTO public.wallet_transactions (user_id, type, amount, status, description)
          VALUES (ref_by, 'earning', reward_amount, 'completed', 'Referral Bonus: ' || NEW.customer_user_id);
          
          -- Notify referrer
          INSERT INTO public.app_notifications (title, message, type, sound_name, target_user_id, is_global)
          VALUES ('Referral Bonus!', 'You earned GHS ' || reward_amount || ' from a referral''s first purchase.', 'success', 'paystack', ref_by, false);
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_first_order_delivered ON public.orders;

CREATE TRIGGER on_first_order_delivered
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.reward_referrer_on_first_order();
