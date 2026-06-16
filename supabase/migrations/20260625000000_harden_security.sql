-- 1. Drop loose SELECT policies
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public track orders" ON public.orders;
DROP POLICY IF EXISTS "Public view settings" ON public.app_settings;

-- 2. Restrict direct SELECT permissions on profiles
REVOKE SELECT ON public.profiles FROM public;
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.profiles FROM authenticated;

-- Grant select on ONLY non-sensitive columns (id, referral_code) to anon (for referral store link setup)
GRANT SELECT (id, referral_code) ON public.profiles TO anon;

-- Grant select on ALL columns to authenticated and service_role
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO service_role;

-- 3. Create hardened SELECT policy for app_settings
CREATE POLICY "Public view settings" ON public.app_settings
  FOR SELECT
  TO anon, authenticated
  USING (
    key NOT IN (
      'data_providers',
      'txtconnect_api_key',
      'theteller_api_key',
      'theteller_api_user',
      'paystack_secret_key'
    )
    AND key NOT LIKE 'crm_agent_%'
  );

-- 4. Create secure RPC for checking loyalty points
CREATE OR REPLACE FUNCTION public.get_loyalty_points(phone_number TEXT, agent_uuid UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  points INT;
BEGIN
  SELECT lp.points_balance INTO points
  FROM public.loyalty_points lp
  JOIN public.profiles p ON p.id = lp.user_id
  WHERE p.phone = phone_number AND lp.agent_id = agent_uuid;
  
  RETURN COALESCE(points, 0);
END;
$$;

-- 5. Create secure RPC for order tracking
CREATE OR REPLACE FUNCTION public.track_order(search_query TEXT)
RETURNS TABLE (
  id UUID,
  reference TEXT,
  payment_reference TEXT,
  recipient_phone TEXT,
  status public.order_status,
  sell_price NUMERIC(10,2),
  created_at TIMESTAMPTZ,
  bundle_size_label TEXT,
  network_name TEXT,
  network_logo_emoji TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  clean_query TEXT := trim(search_query);
  digits TEXT := regexp_replace(clean_query, '\D', '', 'g');
BEGIN
  IF clean_query = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    o.id,
    o.reference,
    o.payment_reference,
    o.recipient_phone,
    o.status,
    o.sell_price,
    o.created_at,
    b.size_label AS bundle_size_label,
    n.name AS network_name,
    n.logo_emoji AS network_logo_emoji
  FROM public.orders o
  LEFT JOIN public.bundles b ON b.id = o.bundle_id
  LEFT JOIN public.networks n ON n.id = o.network_id
  WHERE 
    (digits <> '' AND (o.recipient_phone = digits OR o.customer_phone = digits))
    OR (length(clean_query) >= 4 AND (o.reference ILIKE '%' || clean_query || '%' OR o.payment_reference ILIKE '%' || clean_query || '%'))
  ORDER BY o.created_at DESC
  LIMIT 15;
END;
$$;

-- 6. Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
