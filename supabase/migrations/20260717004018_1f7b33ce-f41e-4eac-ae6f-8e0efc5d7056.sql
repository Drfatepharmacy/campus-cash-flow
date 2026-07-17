
-- Enums
DO $$ BEGIN
  CREATE TYPE public.qr_status AS ENUM ('active','revoked','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.qr_scan_result AS ENUM ('valid','expired','revoked','exhausted','not_found','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- QR codes
CREATE TABLE IF NOT EXISTS public.qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('url','text','email','phone','sms','wifi','vcard','location','event','payment','custom')),
  payload JSONB NOT NULL,
  encoded_value TEXT NOT NULL,
  style JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.qr_status NOT NULL DEFAULT 'active',
  single_use BOOLEAN NOT NULL DEFAULT false,
  max_scans INTEGER,
  scan_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qr_codes_owner ON public.qr_codes(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_qr_codes_status ON public.qr_codes(status);
CREATE INDEX IF NOT EXISTS idx_qr_codes_token ON public.qr_codes(token);
CREATE INDEX IF NOT EXISTS idx_qr_codes_created ON public.qr_codes(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_codes TO authenticated;
GRANT ALL ON public.qr_codes TO service_role;

ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qr_owner_read" ON public.qr_codes FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "qr_owner_insert" ON public.qr_codes FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "qr_owner_update" ON public.qr_codes FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "qr_owner_delete" ON public.qr_codes FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_qr_codes_updated_at
  BEFORE UPDATE ON public.qr_codes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- QR scans
CREATE TABLE IF NOT EXISTS public.qr_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_id UUID REFERENCES public.qr_codes(id) ON DELETE SET NULL,
  token TEXT NOT NULL,
  result public.qr_scan_result NOT NULL,
  scanner_id UUID,
  ip TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qr_scans_qr ON public.qr_scans(qr_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_created ON public.qr_scans(created_at DESC);

GRANT SELECT ON public.qr_scans TO authenticated;
GRANT ALL ON public.qr_scans TO service_role;

ALTER TABLE public.qr_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qr_scans_owner_read" ON public.qr_scans FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.qr_codes q WHERE q.id = qr_scans.qr_id AND q.owner_id = auth.uid())
  );

-- Public lookup — safe projection, no owner info
CREATE OR REPLACE FUNCTION public.qr_lookup(_token TEXT)
RETURNS TABLE (
  id UUID,
  label TEXT,
  description TEXT,
  type TEXT,
  encoded_value TEXT,
  status public.qr_status,
  expires_at TIMESTAMPTZ,
  scan_count INTEGER,
  max_scans INTEGER,
  single_use BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.id, q.label, q.description, q.type, q.encoded_value, q.status,
         q.expires_at, q.scan_count, q.max_scans, q.single_use, q.created_at
  FROM public.qr_codes q
  WHERE q.token = _token AND q.deleted_at IS NULL
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.qr_lookup(TEXT) TO anon, authenticated;

-- Public scan logger — increments count for valid scans
CREATE OR REPLACE FUNCTION public.qr_log_scan(_token TEXT, _ip TEXT, _ua TEXT)
RETURNS public.qr_scan_result
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  q public.qr_codes%ROWTYPE;
  outcome public.qr_scan_result;
BEGIN
  SELECT * INTO q FROM public.qr_codes WHERE token = _token AND deleted_at IS NULL LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.qr_scans(qr_id, token, result, ip, user_agent) VALUES (NULL, _token, 'not_found', _ip, _ua);
    RETURN 'not_found';
  END IF;

  IF q.status = 'revoked' THEN outcome := 'revoked';
  ELSIF q.status = 'archived' THEN outcome := 'archived';
  ELSIF q.expires_at IS NOT NULL AND q.expires_at < now() THEN outcome := 'expired';
  ELSIF q.max_scans IS NOT NULL AND q.scan_count >= q.max_scans THEN outcome := 'exhausted';
  ELSIF q.single_use AND q.scan_count >= 1 THEN outcome := 'exhausted';
  ELSE outcome := 'valid';
  END IF;

  IF outcome = 'valid' THEN
    UPDATE public.qr_codes SET scan_count = scan_count + 1 WHERE id = q.id;
  END IF;

  INSERT INTO public.qr_scans(qr_id, token, result, ip, user_agent) VALUES (q.id, _token, outcome, _ip, _ua);
  RETURN outcome;
END $$;

GRANT EXECUTE ON FUNCTION public.qr_log_scan(TEXT, TEXT, TEXT) TO anon, authenticated;
