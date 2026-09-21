-- 1. Stop anonymous users reading association contact details.
REVOKE SELECT ON public.associations FROM anon;
GRANT SELECT (
  id, slug, name, short_name, type, institution, campus_id, faculty_id, department_id,
  logo_url, banner_url, description, session_year, status, financials_enabled,
  created_at, updated_at
) ON public.associations TO anon;

-- 2. Close the self-escalation path: creators may only keep draft/submitted.
DROP POLICY IF EXISTS "officers can update own association" ON public.associations;
CREATE POLICY "officers can update own association"
ON public.associations FOR UPDATE TO authenticated
USING (
  public.has_assoc_permission(auth.uid(), id, 'association.manage')
  OR (created_by = auth.uid() AND status = ANY (ARRAY['draft'::association_status, 'submitted'::association_status]))
)
WITH CHECK (
  public.has_assoc_permission(auth.uid(), id, 'association.manage')
  OR (created_by = auth.uid() AND status = ANY (ARRAY['draft'::association_status, 'submitted'::association_status]))
);

-- 3. Internal SECURITY DEFINER routines: service_role only.
REVOKE ALL ON FUNCTION public.finalize_payment(text, text, text, text, bigint, text, text, timestamptz, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_role_assignments() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gen_receipt_token() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.qr_lookup(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.qr_log_scan(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_append_only() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.finalize_payment(text, text, text, text, bigint, text, text, timestamptz, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_role_assignments() TO service_role;
GRANT EXECUTE ON FUNCTION public.gen_receipt_token() TO service_role;
GRANT EXECUTE ON FUNCTION public.qr_lookup(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.qr_log_scan(text, text, text) TO service_role;