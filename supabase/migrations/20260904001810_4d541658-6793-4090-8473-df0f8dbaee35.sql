REVOKE EXECUTE ON FUNCTION public.finalize_payment(text, text, text, text, bigint, text, text, timestamptz, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_role_assignments() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gen_receipt_token() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.qr_log_scan(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.qr_lookup(text) FROM anon;