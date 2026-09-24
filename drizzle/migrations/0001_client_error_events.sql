CREATE TABLE public.client_error_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id text NOT NULL,
  route text NOT NULL,
  kind text NOT NULL,
  category text NOT NULL,
  browser text,
  os text,
  device text,
  online boolean,
  user_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX client_error_events_occurred_idx ON public.client_error_events (occurred_at DESC);
GRANT SELECT ON public.client_error_events TO authenticated;
GRANT ALL ON public.client_error_events TO service_role;
ALTER TABLE public.client_error_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read client errors" ON public.client_error_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));