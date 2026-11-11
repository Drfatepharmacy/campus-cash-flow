ALTER TABLE public.receipts ALTER COLUMN transaction_id DROP NOT NULL;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS link_payment_id uuid UNIQUE REFERENCES public.payment_link_payments(id);
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS receipt_no text UNIQUE;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS verification_hash text;
ALTER TABLE public.receipts ADD CONSTRAINT receipts_source_chk CHECK (transaction_id IS NOT NULL OR link_payment_id IS NOT NULL);

CREATE OR REPLACE FUNCTION public.issue_link_receipt(_payment_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
DECLARE tok text; p public.payment_link_payments%ROWTYPE;
BEGIN
  SELECT qr_token INTO tok FROM public.receipts WHERE link_payment_id = _payment_id;
  IF tok IS NOT NULL THEN RETURN tok; END IF;
  SELECT * INTO p FROM public.payment_link_payments WHERE id = _payment_id AND status = 'paid';
  IF NOT FOUND THEN RETURN NULL; END IF;
  tok := public.gen_receipt_token();
  INSERT INTO public.receipts(link_payment_id, qr_token, receipt_no, verification_hash)
  VALUES (p.id, tok, 'UER-' || to_char(coalesce(p.paid_at, now()), 'YYYY') || '-' || substr(tok, 1, 10),
    encode(sha256(convert_to(p.reference || '|' || p.amount_minor || '|' || p.matric_no || '|' || tok, 'UTF8')), 'hex'));
  RETURN tok;
END $$;
REVOKE ALL ON FUNCTION public.issue_link_receipt(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_link_receipt(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_link_payment(_reference text, _provider_ref text, _amount_minor bigint, _currency text, _paid_at timestamp with time zone, _event_id text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p public.payment_link_payments%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.payment_link_payments WHERE reference = _reference FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF p.status = 'paid' THEN PERFORM public.issue_link_receipt(p.id); RETURN 'already_paid'; END IF;
  IF upper(coalesce(_currency,'NGN')) <> upper(p.currency) OR _amount_minor IS DISTINCT FROM p.amount_minor THEN
    INSERT INTO public.payment_ledger(reference, entry_type, amount_minor, currency, provider, provider_ref, provider_event_id, metadata)
    VALUES (_reference, 'amount_mismatch', coalesce(_amount_minor,0), upper(coalesce(_currency,'NGN')), 'paystack', _provider_ref, _event_id,
      jsonb_build_object('kind','payment_link','expected',p.amount_minor));
    RETURN 'amount_mismatch';
  END IF;
  UPDATE public.payment_link_payments SET status='paid', paid_at=coalesce(_paid_at, now()), provider_ref=_provider_ref WHERE id=p.id;
  INSERT INTO public.payment_ledger(reference, entry_type, amount_minor, currency, provider, provider_ref, provider_event_id, metadata)
  VALUES (_reference, 'charge_captured', p.amount_minor, p.currency, 'paystack', _provider_ref, _event_id,
    jsonb_build_object('kind','payment_link','link_id',p.link_id,'association_id',p.association_id));
  INSERT INTO public.audit_logs(action, entity, entity_id, association_id, metadata)
  VALUES ('payment_link.captured','payment_link_payment', p.id::text, p.association_id, jsonb_build_object('reference',_reference,'amount_minor',p.amount_minor));
  PERFORM public.issue_link_receipt(p.id);
  RETURN 'captured';
END $function$;

SELECT public.issue_link_receipt(id) FROM public.payment_link_payments WHERE status = 'paid';