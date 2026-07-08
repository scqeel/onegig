-- Create saved_meters table to allow users to register and alias utility account numbers
CREATE TABLE IF NOT EXISTS public.saved_meters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    meter_number TEXT NOT NULL,
    alias TEXT NOT NULL,
    provider TEXT NOT NULL, -- e.g. 'ECG', 'DSTV', 'GOTV', 'STARTIMES'
    customer_name TEXT,     -- cached validated name if resolved
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, meter_number, provider)
);

ALTER TABLE public.saved_meters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own saved meters"
    ON public.saved_meters FOR ALL
    TO authenticated
    USING (user_id = auth.uid());
