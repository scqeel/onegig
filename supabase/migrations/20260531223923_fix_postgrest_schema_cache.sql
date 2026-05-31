-- Undo the column-level privilege revoke which breaks PostgREST schema cache on some setups
GRANT SELECT (base_price) ON public.bundles TO anon;

-- Force schema cache reload
NOTIFY pgrst, 'reload schema';
