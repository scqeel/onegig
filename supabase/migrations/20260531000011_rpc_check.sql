CREATE OR REPLACE FUNCTION check_momo_table() RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (SELECT count(*) FROM public.momo_subscriptions)::text;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END;
$$;

-- Force schema reload for PostgREST so the RPC is available
NOTIFY pgrst, 'reload schema';
