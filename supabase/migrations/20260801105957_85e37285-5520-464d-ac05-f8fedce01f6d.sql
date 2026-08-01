-- 1. Integer minor units + currency on transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS base_minor bigint,
  ADD COLUMN IF NOT EXISTS charge_minor bigint,
  ADD COLUMN IF NOT EXISTS total_minor bigint,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'NGN';

UPDATE public.transactions SET
  base_minor   = COALESCE(base_minor,   round(base_amount   * 100)::bigint),
  charge_minor = COALESCE(charge_minor, round(service_charge* 100)::bigint),
  total_minor  = COALESCE(total_minor,  round(total_amount  * 100)::bigint);

ALTER TABLE public.transactions
  ALTER COLUMN base_minor SET NOT NULL,
  ALTER COLUMN charge_minor SET NOT NULL,
  ALTER COLUMN total_minor SET NOT NULL;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_minor_nonneg,
  ADD CONSTRAINT transactions_minor_nonneg CHECK (base_minor >= 0 AND charge_minor >= 0 AND total_minor = base_minor + charge_minor);

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_currency_chk,
  ADD CONSTRAINT transactions_currency_chk CHECK (currency = upper(currency) AND length(currency) = 3);

CREATE UNIQUE INDEX IF NOT EXISTS transactions_reference_key ON public.transactions(reference);

-- 2. One receipt per transaction, strong tokens
DELETE FROM public.receipts r
 USING public.receipts r2
 WHERE r.transaction_id = r2.transaction_id AND r.ctid > r2.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS receipts_transaction_id_key ON public.receipts(transaction_id);
CREATE UNIQUE INDEX IF NOT EXISTS receipts_qr_token_key ON public.receipts(qr_token);

-- 3. Append-only payment ledger
CREATE TABLE IF NOT EXISTS public.payment_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES public.transactions(id),
  reference text NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('charge_captured','charge_failed','amount_mismatch','refund','settlement_allocated','adjustment')),
  amount_minor bigint NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  provider text,
  provider_ref text,
  provider_event_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_ledger TO authenticated;
GRANT ALL ON public.payment_ledger TO service_role;
ALTER TABLE public.payment_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ledger_read ON public.payment_ledger;
CREATE POLICY ledger_read ON public.payment_ledger FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = payment_ledger.transaction_id AND t.student_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS payment_ledger_txn_idx ON public.payment_ledger(transaction_id);
CREATE INDEX IF NOT EXISTS payment_ledger_created_idx ON public.payment_ledger(created_at DESC);

-- 4. Generic append-only guard
CREATE OR REPLACE FUNCTION public.tg_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Table %.% is append-only; % is not permitted', TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP;
END $$;

DROP TRIGGER IF EXISTS payment_ledger_append_only ON public.payment_ledger;
CREATE TRIGGER payment_ledger_append_only
  BEFORE UPDATE OR DELETE ON public.payment_ledger
  FOR EACH ROW EXECUTE FUNCTION public.tg_append_only();

DROP TRIGGER IF EXISTS audit_logs_append_only ON public.audit_logs;
CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.tg_append_only();

-- 5. Webhook replay protection
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text,
  reference text,
  payload_hash text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  outcome text,
  UNIQUE (provider, event_id)
);

GRANT SELECT ON public.webhook_events TO authenticated;
GRANT ALL ON public.webhook_events TO service_role;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webhook_events_admin_read ON public.webhook_events;
CREATE POLICY webhook_events_admin_read ON public.webhook_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 6. Strong receipt token generator
CREATE OR REPLACE FUNCTION public.gen_receipt_token()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public, extensions AS $$
  SELECT upper(encode(gen_random_bytes(24), 'hex'))
$$;

-- 7. Atomic, verified, retry-safe payment finalisation
CREATE OR REPLACE FUNCTION public.finalize_payment(
  _reference text,
  _provider text,
  _provider_ref text,
  _provider_event_id text,
  _amount_minor bigint,
  _currency text,
  _customer_email text,
  _paid_at timestamptz,
  _raw jsonb
)
RETURNS TABLE(outcome text, transaction_id uuid, qr_token text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  t public.transactions%ROWTYPE;
  student_email text;
  tok text;
BEGIN
  SELECT * INTO t FROM public.transactions WHERE reference = _reference FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.payment_ledger(reference, entry_type, amount_minor, currency, provider, provider_ref, provider_event_id, metadata)
    VALUES (_reference, 'amount_mismatch', COALESCE(_amount_minor,0), COALESCE(upper(_currency),'NGN'), _provider, _provider_ref, _provider_event_id,
            jsonb_build_object('reason','unknown_reference'));
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  IF t.status = 'paid' THEN
    SELECT r.qr_token INTO tok FROM public.receipts r WHERE r.transaction_id = t.id;
    RETURN QUERY SELECT 'already_paid'::text, t.id, tok;
    RETURN;
  END IF;

  IF upper(COALESCE(_currency, 'NGN')) IS DISTINCT FROM upper(t.currency) THEN
    INSERT INTO public.payment_ledger(transaction_id, reference, entry_type, amount_minor, currency, provider, provider_ref, provider_event_id, metadata)
    VALUES (t.id, _reference, 'amount_mismatch', COALESCE(_amount_minor,0), upper(COALESCE(_currency,'NGN')), _provider, _provider_ref, _provider_event_id,
            jsonb_build_object('reason','currency_mismatch','expected',t.currency));
    RETURN QUERY SELECT 'currency_mismatch'::text, t.id, NULL::text;
    RETURN;
  END IF;

  IF _amount_minor IS DISTINCT FROM t.total_minor THEN
    INSERT INTO public.payment_ledger(transaction_id, reference, entry_type, amount_minor, currency, provider, provider_ref, provider_event_id, metadata)
    VALUES (t.id, _reference, 'amount_mismatch', COALESCE(_amount_minor,0), upper(COALESCE(_currency,'NGN')), _provider, _provider_ref, _provider_event_id,
            jsonb_build_object('reason','amount_mismatch','expected',t.total_minor));
    INSERT INTO public.audit_logs(action, entity, entity_id, metadata)
    VALUES ('payment.amount_mismatch','transaction', t.id::text,
            jsonb_build_object('reference',_reference,'expected',t.total_minor,'received',_amount_minor));
    RETURN QUERY SELECT 'amount_mismatch'::text, t.id, NULL::text;
    RETURN;
  END IF;

  IF _customer_email IS NOT NULL THEN
    SELECT p.email INTO student_email FROM public.profiles p WHERE p.id = t.student_id;
    IF student_email IS NOT NULL AND lower(student_email) IS DISTINCT FROM lower(_customer_email) THEN
      INSERT INTO public.audit_logs(action, entity, entity_id, metadata)
      VALUES ('payment.customer_mismatch','transaction', t.id::text,
              jsonb_build_object('reference',_reference,'received',_customer_email));
    END IF;
  END IF;

  UPDATE public.transactions
     SET status = 'paid',
         paid_at = COALESCE(_paid_at, now()),
         paystack_ref = COALESCE(_provider_ref, paystack_ref),
         paystack_response = COALESCE(_raw, paystack_response),
         updated_at = now()
   WHERE id = t.id AND status <> 'paid';

  tok := public.gen_receipt_token();
  INSERT INTO public.receipts(transaction_id, qr_token) VALUES (t.id, tok)
    ON CONFLICT (transaction_id) DO NOTHING;
  SELECT r.qr_token INTO tok FROM public.receipts r WHERE r.transaction_id = t.id;

  INSERT INTO public.payment_ledger(transaction_id, reference, entry_type, amount_minor, currency, provider, provider_ref, provider_event_id, metadata)
  VALUES (t.id, _reference, 'charge_captured', t.total_minor, t.currency, _provider, _provider_ref, _provider_event_id,
          jsonb_build_object('base_minor',t.base_minor,'charge_minor',t.charge_minor));

  INSERT INTO public.audit_logs(action, entity, entity_id, metadata)
  VALUES ('payment.captured','transaction', t.id::text,
          jsonb_build_object('reference',_reference,'amount_minor',t.total_minor,'provider',_provider));

  RETURN QUERY SELECT 'captured'::text, t.id, tok;
END $$;

REVOKE ALL ON FUNCTION public.finalize_payment(text,text,text,text,bigint,text,text,timestamptz,jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_payment(text,text,text,text,bigint,text,text,timestamptz,jsonb) TO service_role;