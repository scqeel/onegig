CREATE OR REPLACE FUNCTION public.sync_wallet_balance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE public.profiles
        SET wallet_balance = public.get_wallet_balance(NEW.user_id)
        WHERE id = NEW.user_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.profiles
        SET wallet_balance = public.get_wallet_balance(OLD.user_id)
        WHERE id = OLD.user_id;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_wallet_balance ON public.wallet_transactions;
CREATE TRIGGER trg_sync_wallet_balance
AFTER INSERT OR UPDATE OR DELETE ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_wallet_balance();

UPDATE public.profiles p
SET wallet_balance = public.get_wallet_balance(p.id);
