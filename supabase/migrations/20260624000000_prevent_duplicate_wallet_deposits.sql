-- Prevent duplicate wallet deposits
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS reference TEXT;

-- Backfill reference from description
UPDATE public.wallet_transactions
SET reference = COALESCE(
  CASE 
    WHEN description LIKE '%Manually Resolved:%' THEN substring(description from 'Manually Resolved: ([^)]+)')
    ELSE substring(description from '\(([^)]+)\)')
  END,
  substring(description from '\(([^)]+)\)')
)
WHERE type = 'deposit' AND reference IS NULL;

-- Create partial unique index to prevent duplicate deposits
CREATE UNIQUE INDEX IF NOT EXISTS unique_wallet_transaction_reference 
ON public.wallet_transactions (reference) 
WHERE reference IS NOT NULL;
