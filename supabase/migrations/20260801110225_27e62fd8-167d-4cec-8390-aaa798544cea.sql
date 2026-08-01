REVOKE ALL ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_append_only() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gen_receipt_token() FROM public, anon, authenticated;

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

  IF nullif(btrim(COALESCE(_customer_email,'')),'') IS NOT NULL THEN
    SELECT p.email INTO student_email FROM public.profiles p WHERE p.id = t.student_id;
    IF student_email IS NOT NULL AND lower(student_email) IS DISTINCT FROM lower(btrim(_customer_email)) THEN
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