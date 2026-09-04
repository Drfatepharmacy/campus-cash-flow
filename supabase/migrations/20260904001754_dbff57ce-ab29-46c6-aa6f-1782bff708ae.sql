ALTER TABLE public.association_financial_accounts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS officer_approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS officer_approved_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.association_financial_accounts
    ADD CONSTRAINT association_financial_accounts_status_chk
    CHECK (status IN ('pending','officer_approved','verified','rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE public.association_financial_accounts SET status = 'verified' WHERE verified = true AND status = 'pending';