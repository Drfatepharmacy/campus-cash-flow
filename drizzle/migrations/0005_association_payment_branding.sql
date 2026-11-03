ALTER TABLE public.associations ADD COLUMN IF NOT EXISTS branding_logo_path text;
ALTER TABLE public.payment_links ADD COLUMN IF NOT EXISTS banner_path text;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS banner_path text;
COMMENT ON COLUMN public.associations.branding_logo_path IS 'Private Storage path for association logo, resolved to a temporary URL by authorized or public payment reads';
COMMENT ON COLUMN public.payment_links.banner_path IS 'Private association-scoped payment banner';
COMMENT ON COLUMN public.payment_requests.banner_path IS 'Private association-scoped payment banner';