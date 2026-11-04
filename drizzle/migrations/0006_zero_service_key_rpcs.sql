CREATE OR REPLACE FUNCTION public.record_audit_event(
  _action text, _entity text, _entity_id text DEFAULT NULL,
  _association_id uuid DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _uid uuid := auth.uid(); _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF length(_action) > 120 OR length(coalesce(_entity,'')) > 80 THEN RAISE EXCEPTION 'invalid audit input'; END IF;
  IF _association_id IS NOT NULL AND NOT (
       public.is_association_member(_uid, _association_id)
       OR EXISTS (SELECT 1 FROM public.associations a WHERE a.id = _association_id AND a.created_by = _uid)
       OR public.is_super_admin(_uid)) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, association_id, metadata)
  VALUES (_uid, _action, _entity, _entity_id, _association_id, coalesce(_metadata,'{}'::jsonb))
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.record_audit_event(text,text,text,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_audit_event(text,text,text,uuid,jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mask_name(_n text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT string_agg(CASE WHEN length(w) <= 2 THEN w ELSE left(w,2) || repeat('*', length(w)-2) END, ' ')
  FROM unnest(string_to_array(coalesce(_n,''), ' ')) w WHERE w <> ''
$$;

CREATE OR REPLACE FUNCTION public.verify_public_receipt(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r record; t record; p record;
BEGIN
  IF _token IS NULL OR length(_token) < 8 OR length(_token) > 128 THEN RETURN jsonb_build_object('valid', false); END IF;
  SELECT * INTO r FROM public.receipts WHERE qr_token = _token LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('valid', false); END IF;
  IF r.transaction_id IS NOT NULL THEN
    SELECT tx.reference, tx.total_amount, tx.status, tx.paid_at, pr.title, pf.full_name, pf.matric_no INTO t
    FROM public.transactions tx
    LEFT JOIN public.payment_requests pr ON pr.id = tx.payment_request_id
    LEFT JOIN public.profiles pf ON pf.id = tx.student_id WHERE tx.id = r.transaction_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('valid', false); END IF;
    RETURN jsonb_build_object('valid', true, 'receipt_id', coalesce(r.receipt_no, r.id::text), 'issued_at', r.issued_at,
      'reference', t.reference, 'title', coalesce(t.title,'Payment'), 'amount', t.total_amount, 'status', t.status,
      'paid_at', t.paid_at, 'student_name', coalesce(public.mask_name(t.full_name),'—'),
      'matric_no', CASE WHEN t.matric_no IS NULL THEN '—' ELSE left(t.matric_no,5) || repeat('*', greatest(length(t.matric_no)-5,0)) END);
  END IF;
  SELECT lp.reference, lp.payer_name, lp.matric_no, lp.class_label, lp.amount_minor, lp.status, lp.paid_at, l.title, a.name AS assoc INTO p
  FROM public.payment_link_payments lp
  LEFT JOIN public.payment_links l ON l.id = lp.link_id
  LEFT JOIN public.associations a ON a.id = lp.association_id WHERE lp.id = r.link_payment_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('valid', false); END IF;
  RETURN jsonb_build_object('valid', true, 'receipt_id', coalesce(r.receipt_no, left(_token,10)), 'issued_at', r.issued_at,
    'reference', p.reference, 'title', coalesce(p.title,'Payment') || ' · ' || coalesce(p.assoc,''),
    'amount', p.amount_minor::numeric / 100, 'status', p.status, 'paid_at', p.paid_at,
    'student_name', public.mask_name(p.payer_name),
    'matric_no', left(p.matric_no,5) || repeat('*', greatest(length(p.matric_no)-5,0)) || ' · Class ' || p.class_label);
END $$;
REVOKE ALL ON FUNCTION public.verify_public_receipt(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_public_receipt(text) TO anon, authenticated, service_role;