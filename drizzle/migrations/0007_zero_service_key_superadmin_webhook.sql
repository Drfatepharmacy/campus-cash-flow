-- Super Admin reach via RLS (no service key)
CREATE POLICY "super admin updates associations" ON public.associations FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "super admin reads memberships" ON public.association_memberships FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "super admin writes memberships" ON public.association_memberships FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "super admin updates memberships" ON public.association_memberships FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "super admin reads profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "super admin reads bank details" ON public.association_financial_accounts FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "super admin reads approval requests" ON public.approval_requests FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "super admin reads nominations" ON public.leadership_nominations FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "super admin reads all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "super admin grants admin role" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()) AND role <> 'super_admin');
CREATE POLICY "super admin revokes admin role" ON public.user_roles FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()) AND role <> 'super_admin');
GRANT EXECUTE ON FUNCTION public.expire_role_assignments() TO authenticated;

-- Private key check for server-to-database calls that have no signed-in user (Paystack confirmations)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS private.internal_secrets (name text PRIMARY KEY, sha256 text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON private.internal_secrets FROM PUBLIC, anon, authenticated;
INSERT INTO private.internal_secrets(name, sha256) VALUES ('server_rpc', 'd488ac2990e3fb010d558419d9bf4d70adec48a0a191acbbbb34d0824b2da7a1')
  ON CONFLICT (name) DO UPDATE SET sha256 = EXCLUDED.sha256;

CREATE OR REPLACE FUNCTION private.check_server_secret(_secret text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = private, public, extensions, pg_temp AS $$
BEGIN
  IF _secret IS NULL OR NOT EXISTS (SELECT 1 FROM private.internal_secrets
     WHERE name = 'server_rpc' AND sha256 = encode(extensions.digest(_secret, 'sha256'), 'hex')) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.svc_paystack_charge(
  _secret text, _event_id text, _payload_hash text, _reference text, _provider_ref text,
  _amount_minor bigint, _currency text, _customer_email text, _paid_at timestamptz, _raw jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
DECLARE _out text; _row record; _res jsonb; p record; r record;
BEGIN
  PERFORM private.check_server_secret(_secret);
  IF _reference !~ '^[A-Za-z0-9-]{8,80}$' THEN RAISE EXCEPTION 'bad reference'; END IF;
  BEGIN
    INSERT INTO public.webhook_events(provider, event_id, event_type, reference, payload_hash, outcome)
    VALUES ('paystack', _event_id, 'charge.success', _reference, _payload_hash, 'processing');
  EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('outcome', 'duplicate');
  END;
  IF _reference LIKE 'PL-%' THEN
    _out := public.finalize_link_payment(_reference, _provider_ref, _amount_minor, _currency, _paid_at, _event_id);
    UPDATE public.webhook_events SET outcome = _out WHERE provider = 'paystack' AND event_id = _event_id;
    _res := jsonb_build_object('outcome', _out, 'kind', 'link');
    IF _out = 'captured' THEN
      SELECT lp.*, l.title, a.name AS assoc INTO p FROM public.payment_link_payments lp
        LEFT JOIN public.payment_links l ON l.id = lp.link_id LEFT JOIN public.associations a ON a.id = lp.association_id
        WHERE lp.reference = _reference;
      SELECT * INTO r FROM public.receipts WHERE link_payment_id = p.id;
      IF r.id IS NOT NULL THEN
        _res := _res || jsonb_build_object('receipt', jsonb_build_object(
          'reference', p.reference, 'payer_name', p.payer_name, 'matric_no', p.matric_no, 'class_label', p.class_label,
          'payer_email', p.payer_email, 'amount_minor', p.amount_minor, 'currency', p.currency, 'paid_at', p.paid_at,
          'title', coalesce(p.title,'Payment'), 'association', coalesce(p.assoc,'Association'),
          'receipt_no', r.receipt_no, 'qr_token', r.qr_token, 'verification_hash', r.verification_hash, 'issued_at', r.issued_at));
      END IF;
    END IF;
    RETURN _res;
  END IF;
  SELECT * INTO _row FROM public.finalize_payment(_reference, 'paystack', _provider_ref, _event_id, _amount_minor, _currency, _customer_email, _paid_at, _raw) LIMIT 1;
  UPDATE public.webhook_events SET outcome = coalesce(_row.outcome,'unknown') WHERE provider = 'paystack' AND event_id = _event_id;
  _res := jsonb_build_object('outcome', coalesce(_row.outcome,'unknown'), 'kind', 'txn', 'qr_token', _row.qr_token);
  IF _row.outcome = 'captured' THEN
    SELECT tx.total_amount, pf.email, pf.full_name, pr.title INTO p FROM public.transactions tx
      LEFT JOIN public.profiles pf ON pf.id = tx.student_id LEFT JOIN public.payment_requests pr ON pr.id = tx.payment_request_id
      WHERE tx.reference = _reference;
    _res := _res || jsonb_build_object('total_amount', p.total_amount, 'email', p.email, 'full_name', p.full_name, 'title', p.title);
  END IF;
  RETURN _res;
END $$;

CREATE OR REPLACE FUNCTION public.svc_paystack_refund(_secret text, _event text, _tx_ref text, _provider_refund_id text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
DECLARE rr record;
BEGIN
  PERFORM private.check_server_secret(_secret);
  SELECT * INTO rr FROM public.refund_requests WHERE reference = _tx_ref AND status IN ('processing','approved') LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF _event = 'refund.failed' THEN
    UPDATE public.refund_requests SET status = 'failed', failure_reason = 'Provider reported refund failure' WHERE id = rr.id;
  ELSIF _event = 'refund.processed' THEN
    UPDATE public.refund_requests SET status = 'processed', processed_at = now() WHERE id = rr.id;
    IF rr.transaction_id IS NOT NULL THEN UPDATE public.transactions SET status = 'refunded' WHERE id = rr.transaction_id; END IF;
    IF rr.link_payment_id IS NOT NULL THEN UPDATE public.payment_link_payments SET status = 'refunded' WHERE id = rr.link_payment_id; END IF;
    INSERT INTO public.payment_ledger(transaction_id, reference, entry_type, amount_minor, currency, provider, provider_ref, provider_event_id, metadata)
    VALUES (rr.transaction_id, rr.reference, 'refund', -rr.amount_minor, 'NGN', 'paystack', _provider_refund_id, 'refund:' || coalesce(nullif(_provider_refund_id,''), rr.id::text), jsonb_build_object('refund_request_id', rr.id))
    ON CONFLICT DO NOTHING;
  ELSE RETURN 'ignored'; END IF;
  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, association_id, metadata)
  VALUES (NULL, _event, 'refund_request', rr.id::text, rr.association_id, jsonb_build_object('reference', rr.reference, 'source', 'paystack_webhook'));
  RETURN 'ok';
END $$;

REVOKE ALL ON FUNCTION public.svc_paystack_charge(text,text,text,text,text,bigint,text,text,timestamptz,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.svc_paystack_refund(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.svc_paystack_charge(text,text,text,text,text,bigint,text,text,timestamptz,jsonb) TO anon, service_role;
GRANT EXECUTE ON FUNCTION public.svc_paystack_refund(text,text,text,text) TO anon, service_role;
REVOKE ALL ON FUNCTION private.check_server_secret(text) FROM PUBLIC, anon, authenticated;