-- Add new wallet transaction types
COMMIT;
ALTER TYPE public.wallet_tx_type ADD VALUE IF NOT EXISTS 'deposit';
ALTER TYPE public.wallet_tx_type ADD VALUE IF NOT EXISTS 'purchase';
BEGIN;

-- Update get_wallet_balance function to include the new types
CREATE OR REPLACE FUNCTION public.get_wallet_balance(_user_id UUID)
RETURNS NUMERIC LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN type IN ('earning','refund','adjustment','deposit') AND status = 'completed' THEN amount
      WHEN type IN ('withdrawal','purchase','activation_fee') AND status IN ('pending','completed') THEN -amount
      ELSE 0
    END
  ), 0)
  FROM public.wallet_transactions
  WHERE user_id = _user_id;
$$;

-- Create agent_customers table for the CRM
CREATE TABLE IF NOT EXISTS public.agent_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, phone)
);

ALTER TABLE public.agent_customers ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER agent_customers_updated_at BEFORE UPDATE ON public.agent_customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS Policies for CRM
CREATE POLICY "Agents manage own customers" ON public.agent_customers FOR ALL TO authenticated
  USING (agent_id IN (SELECT id FROM public.agent_profiles WHERE user_id = auth.uid()))
  WITH CHECK (agent_id IN (SELECT id FROM public.agent_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins manage all customers" ON public.agent_customers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) 
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
