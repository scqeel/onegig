INSERT INTO public.app_settings (key, value)
VALUES ('active_payment_gateway', '"paystack"'::jsonb)
ON CONFLICT (key) DO NOTHING;
