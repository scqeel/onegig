-- Backfill user_price if it's null, so the storefront and API can always rely on user_price for the public fallback.
UPDATE public.bundles SET user_price = base_price WHERE user_price IS NULL;

-- Make sure future inserts without a user_price default to base_price (via a trigger or just rely on backend logic)
-- Actually, the easiest way is a trigger to ensure user_price is never null if base_price is set.
CREATE OR REPLACE FUNCTION public.ensure_user_price_not_null()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_price IS NULL THEN
    NEW.user_price := NEW.base_price;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_ensure_user_price ON public.bundles;
CREATE TRIGGER trigger_ensure_user_price
  BEFORE INSERT OR UPDATE ON public.bundles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_user_price_not_null();

-- Secure the base_price column by revoking access from anon role
REVOKE SELECT (base_price) ON public.bundles FROM anon;

-- Force schema cache reload
NOTIFY pgrst, 'reload schema';
