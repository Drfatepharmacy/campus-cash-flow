ALTER TABLE public.association_financial_accounts
  ADD COLUMN IF NOT EXISTS bank_code text,
  ADD COLUMN IF NOT EXISTS nuban_resolved_name text,
  ADD COLUMN IF NOT EXISTS nuban_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS paystack_subaccount_code text,
  ADD COLUMN IF NOT EXISTS subaccount_error text;

ALTER TABLE public.payment_link_payments DROP CONSTRAINT IF EXISTS payment_link_payments_status_check;
ALTER TABLE public.payment_link_payments ADD CONSTRAINT payment_link_payments_status_check
  CHECK (status IN ('pending','paid','failed','refunded'));
ALTER TABLE public.payment_link_payments ADD COLUMN IF NOT EXISTS subaccount_code text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS subaccount_code text;

CREATE TABLE public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('transaction','link_payment')),
  transaction_id uuid REFERENCES public.transactions(id),
  link_payment_id uuid REFERENCES public.payment_link_payments(id),
  association_id uuid REFERENCES public.associations(id),
  reference text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  reason_type text NOT NULL CHECK (reason_type IN ('duplicate','overcharged','service_not_rendered','wrong_payment','other')),
  reason text NOT NULL,
  requester_id uuid,
  requester_contact text,
  duplicate_suspected boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','processing','processed','failed')),
  decided_by uuid,
  decided_at timestamptz,
  decision_reason text,
  paystack_refund_id text,
  failure_reason text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (decided_by IS NULL OR requester_id IS NULL OR decided_by <> requester_id)
);
CREATE UNIQUE INDEX refund_requests_one_open_per_ref ON public.refund_requests(reference)
  WHERE status IN ('pending','approved','processing','processed');
CREATE INDEX refund_requests_status_idx ON public.refund_requests(status, created_at DESC);

GRANT SELECT ON public.refund_requests TO authenticated;
GRANT ALL ON public.refund_requests TO service_role;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requesters see their own refund requests" ON public.refund_requests
  FOR SELECT TO authenticated USING (requester_id = auth.uid());
CREATE POLICY "Platform admins see all refund requests" ON public.refund_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER refund_requests_updated_at BEFORE UPDATE ON public.refund_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();