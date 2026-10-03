CREATE TABLE public.payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.associations(id),
  token text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  class_prices jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.payment_links TO service_role;
GRANT SELECT ON public.payment_links TO authenticated;
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Officers view links" ON public.payment_links FOR SELECT TO authenticated
  USING (public.has_assoc_permission(auth.uid(), association_id, 'dues.view'));
CREATE TRIGGER payment_links_updated BEFORE UPDATE ON public.payment_links FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.payment_link_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.payment_links(id),
  association_id uuid NOT NULL REFERENCES public.associations(id),
  reference text NOT NULL UNIQUE,
  payer_name text NOT NULL,
  matric_no text NOT NULL,
  class_label text NOT NULL,
  payer_email text,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL DEFAULT 'NGN',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),
  source text NOT NULL DEFAULT 'online' CHECK (source IN ('online','offline')),
  offline_method text,
  note text,
  provider_ref text,
  recorded_by uuid,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX plp_link_idx ON public.payment_link_payments(link_id, status);
GRANT ALL ON public.payment_link_payments TO service_role;
GRANT SELECT ON public.payment_link_payments TO authenticated;
ALTER TABLE public.payment_link_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Officers view link payments" ON public.payment_link_payments FOR SELECT TO authenticated
  USING (public.has_assoc_permission(auth.uid(), association_id, 'dues.view'));

CREATE TABLE public.payment_link_roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.payment_links(id),
  association_id uuid NOT NULL REFERENCES public.associations(id),
  matric_no text NOT NULL,
  full_name text,
  class_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (link_id, matric_no)
);
GRANT ALL ON public.payment_link_roster TO service_role;
GRANT SELECT ON public.payment_link_roster TO authenticated;
ALTER TABLE public.payment_link_roster ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Officers view roster" ON public.payment_link_roster FOR SELECT TO authenticated
  USING (public.has_assoc_permission(auth.uid(), association_id, 'dues.view'));

CREATE OR REPLACE FUNCTION public.finalize_link_payment(_reference text, _provider_ref text, _amount_minor bigint, _currency text, _paid_at timestamptz, _event_id text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.payment_link_payments%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.payment_link_payments WHERE reference = _reference FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF p.status = 'paid' THEN RETURN 'already_paid'; END IF;
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
  RETURN 'captured';
END $$;
REVOKE EXECUTE ON FUNCTION public.finalize_link_payment(text,text,bigint,text,timestamptz,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_link_payment(text,text,bigint,text,timestamptz,text) TO service_role;