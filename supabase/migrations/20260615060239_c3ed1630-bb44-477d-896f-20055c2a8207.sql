ALTER TABLE public.transactions ADD COLUMN settlement_id uuid REFERENCES public.settlements(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_txn_settlement ON public.transactions(settlement_id);
ALTER TABLE public.settlements ADD COLUMN IF NOT EXISTS settled_at timestamptz;
ALTER TABLE public.settlements ADD COLUMN IF NOT EXISTS bank_reference text;