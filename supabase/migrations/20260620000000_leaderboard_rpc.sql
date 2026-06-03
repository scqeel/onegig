-- Create a security definer RPC to fetch agent leaderboard statistics safely bypassing RLS
CREATE OR REPLACE FUNCTION public.get_agent_leaderboard()
RETURNS TABLE (
  id UUID,
  store_name TEXT,
  store_slug TEXT,
  count BIGINT,
  volume NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ap.id,
    ap.store_name,
    ap.store_slug,
    COALESCE(COUNT(o.id), 0)::BIGINT as count,
    COALESCE(SUM(o.sell_price), 0)::NUMERIC as volume
  FROM public.agent_profiles ap
  LEFT JOIN public.orders o ON o.agent_id = ap.id AND o.status = 'delivered'
  WHERE ap.activation_paid = true
  GROUP BY ap.id, ap.store_name, ap.store_slug
  ORDER BY volume DESC;
END;
$$;

-- Grant execution permission on the function to public (anon/authenticated users)
GRANT EXECUTE ON FUNCTION public.get_agent_leaderboard() TO authenticated, anon;
