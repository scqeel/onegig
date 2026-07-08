-- Drop NOT NULL constraints on orders table to support airtime and bill payments
ALTER TABLE public.orders ALTER COLUMN bundle_id DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN network_id DROP NOT NULL;
