-- ============ ENUMS ============
CREATE TYPE public.association_status AS ENUM ('draft','submitted','under_review','verified','active','suspended','archived');
CREATE TYPE public.association_type AS ENUM ('departmental','faculty','institutional','religious','social','professional','sports','other');
CREATE TYPE public.membership_status AS ENUM ('pending','active','suspended','removed');
CREATE TYPE public.assignment_status AS ENUM ('pending','active','expired','suspended','revoked');
CREATE TYPE public.nomination_status AS ENUM ('draft','submitted','under_review','approved','rejected','withdrawn');
CREATE TYPE public.approval_request_status AS ENUM ('pending','approved','rejected','executed','cancelled');

-- ============ ASSOCIATIONS ============
CREATE TABLE public.associations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  short_name text,
  type public.association_type NOT NULL DEFAULT 'departmental',
  institution text NOT NULL,
  campus_id uuid REFERENCES public.campuses(id),
  faculty_id uuid REFERENCES public.faculties(id),
  department_id uuid REFERENCES public.departments(id),
  official_email text,
  official_phone text,
  logo_url text,
  banner_url text,
  description text,
  session_year text,
  verification_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  status public.association_status NOT NULL DEFAULT 'draft',
  status_reason text,
  financials_enabled boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_associations_status ON public.associations(status);

-- ============ ROLE / PERMISSION CATALOGUE ============
CREATE TABLE public.association_roles (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_head boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.permissions (
  key text PRIMARY KEY,
  description text NOT NULL,
  sensitive boolean NOT NULL DEFAULT false
);

CREATE TABLE public.role_permissions (
  role_key text NOT NULL REFERENCES public.association_roles(key) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role_key, permission_key)
);

-- ============ MEMBERSHIPS ============
CREATE TABLE public.association_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.membership_status NOT NULL DEFAULT 'pending',
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (association_id, user_id)
);
CREATE INDEX idx_memberships_user ON public.association_memberships(user_id);

-- ============ EXECUTIVE TERMS ============
CREATE TABLE public.executive_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  label text NOT NULL,
  session_year text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  is_current boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_terms_assoc ON public.executive_terms(association_id);

-- ============ ROLE ASSIGNMENTS ============
CREATE TABLE public.association_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_key text NOT NULL REFERENCES public.association_roles(key),
  term_id uuid REFERENCES public.executive_terms(id) ON DELETE SET NULL,
  status public.assignment_status NOT NULL DEFAULT 'pending',
  appointment_source text NOT NULL DEFAULT 'nomination',
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  revocation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_assignments_lookup ON public.association_role_assignments(user_id, association_id, status);
CREATE UNIQUE INDEX uq_active_role_holder ON public.association_role_assignments(association_id, role_key)
  WHERE status = 'active';

-- ============ LEADERSHIP NOMINATIONS ============
CREATE TABLE public.leadership_nominations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  nominee_user_id uuid REFERENCES auth.users(id),
  nominee_email text,
  nominee_name text NOT NULL,
  role_key text NOT NULL REFERENCES public.association_roles(key),
  term_id uuid REFERENCES public.executive_terms(id) ON DELETE SET NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  status public.nomination_status NOT NULL DEFAULT 'submitted',
  submitted_by uuid REFERENCES auth.users(id),
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_nominations_assoc ON public.leadership_nominations(association_id, status);

-- ============ FINANCIAL ACCOUNTS ============
CREATE TABLE public.association_financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  account_name text NOT NULL,
  account_number text NOT NULL,
  account_last4 text NOT NULL,
  is_primary boolean NOT NULL DEFAULT true,
  verified boolean NOT NULL DEFAULT false,
  verified_by uuid REFERENCES auth.users(id),
  verified_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fin_accounts_assoc ON public.association_financial_accounts(association_id);

-- ============ MAKER-CHECKER APPROVAL REQUESTS ============
CREATE TABLE public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  status public.approval_request_status NOT NULL DEFAULT 'pending',
  requires_super_admin boolean NOT NULL DEFAULT false,
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  decision_reason text,
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approver_is_not_requester CHECK (approved_by IS NULL OR approved_by <> requested_by)
);
CREATE INDEX idx_approval_requests_assoc ON public.approval_requests(association_id, status);

-- ============ TENANT LINKS ON EXISTING TABLES ============
ALTER TABLE public.payment_requests ADD COLUMN association_id uuid REFERENCES public.associations(id);
ALTER TABLE public.transactions ADD COLUMN association_id uuid REFERENCES public.associations(id);
ALTER TABLE public.settlements ADD COLUMN association_id uuid REFERENCES public.associations(id);
ALTER TABLE public.audit_logs ADD COLUMN association_id uuid REFERENCES public.associations(id);
CREATE INDEX idx_payment_requests_assoc ON public.payment_requests(association_id);
CREATE INDEX idx_transactions_assoc ON public.transactions(association_id);

-- ============ AUTHORIZATION HELPERS ============
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

CREATE OR REPLACE FUNCTION public.is_association_member(_user_id uuid, _association_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.association_memberships m
    WHERE m.user_id = _user_id AND m.association_id = _association_id AND m.status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.has_assoc_permission(_user_id uuid, _association_id uuid, _permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(_user_id) OR EXISTS (
    SELECT 1
    FROM public.association_role_assignments a
    JOIN public.role_permissions rp ON rp.role_key = a.role_key
    WHERE a.user_id = _user_id
      AND a.association_id = _association_id
      AND a.status = 'active'
      AND a.starts_at <= now()
      AND (a.ends_at IS NULL OR a.ends_at > now())
      AND rp.permission_key = _permission
  )
$$;

-- Expire tenures whose end date has passed.
CREATE OR REPLACE FUNCTION public.expire_role_assignments()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.association_role_assignments
     SET status = 'expired', updated_at = now()
   WHERE status = 'active' AND ends_at IS NOT NULL AND ends_at <= now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- ============ GRANTS ============
GRANT SELECT ON public.associations TO anon;
GRANT SELECT, INSERT, UPDATE ON public.associations TO authenticated;
GRANT ALL ON public.associations TO service_role;

GRANT SELECT ON public.association_roles TO anon, authenticated;
GRANT ALL ON public.association_roles TO service_role;
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.association_memberships TO authenticated;
GRANT ALL ON public.association_memberships TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.executive_terms TO authenticated;
GRANT ALL ON public.executive_terms TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.association_role_assignments TO authenticated;
GRANT ALL ON public.association_role_assignments TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.leadership_nominations TO authenticated;
GRANT ALL ON public.leadership_nominations TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.association_financial_accounts TO authenticated;
GRANT ALL ON public.association_financial_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.approval_requests TO authenticated;
GRANT ALL ON public.approval_requests TO service_role;

-- ============ RLS ============
ALTER TABLE public.associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.association_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.association_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executive_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.association_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leadership_nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.association_financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

-- Catalogue tables are readable reference data.
CREATE POLICY "roles readable" ON public.association_roles FOR SELECT USING (true);
CREATE POLICY "permissions readable" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions readable" ON public.role_permissions FOR SELECT TO authenticated USING (true);

-- Associations: public directory of active ones; members/officers see their own; super admin sees all.
CREATE POLICY "active associations are public" ON public.associations
  FOR SELECT USING (status = 'active');
CREATE POLICY "own associations visible" ON public.associations
  FOR SELECT TO authenticated USING (
    created_by = auth.uid()
    OR public.is_association_member(auth.uid(), id)
    OR public.is_super_admin(auth.uid())
  );
CREATE POLICY "authenticated can create draft associations" ON public.associations
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND status = 'draft');
CREATE POLICY "officers can update own association" ON public.associations
  FOR UPDATE TO authenticated
  USING (public.has_assoc_permission(auth.uid(), id, 'association.manage') OR (created_by = auth.uid() AND status IN ('draft','submitted')))
  WITH CHECK (public.has_assoc_permission(auth.uid(), id, 'association.manage') OR (created_by = auth.uid() AND status IN ('draft','submitted','under_review')));

-- Memberships
CREATE POLICY "members read own membership" ON public.association_memberships
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR public.has_assoc_permission(auth.uid(), association_id, 'members.view')
  );
CREATE POLICY "users can request membership" ON public.association_memberships
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "officers manage memberships" ON public.association_memberships
  FOR UPDATE TO authenticated
  USING (public.has_assoc_permission(auth.uid(), association_id, 'members.manage'))
  WITH CHECK (public.has_assoc_permission(auth.uid(), association_id, 'members.manage'));
CREATE POLICY "officers remove memberships" ON public.association_memberships
  FOR DELETE TO authenticated USING (public.has_assoc_permission(auth.uid(), association_id, 'members.manage'));

-- Terms
CREATE POLICY "terms visible to association" ON public.executive_terms
  FOR SELECT TO authenticated USING (
    public.is_association_member(auth.uid(), association_id) OR public.is_super_admin(auth.uid())
  );
CREATE POLICY "super admin writes terms" ON public.executive_terms
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "super admin updates terms" ON public.executive_terms
  FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- Role assignments: readable by association, writable only by super admin (head approval is platform-controlled).
CREATE POLICY "assignments visible to association" ON public.association_role_assignments
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR public.is_association_member(auth.uid(), association_id)
    OR public.is_super_admin(auth.uid())
  );
CREATE POLICY "super admin creates assignments" ON public.association_role_assignments
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "super admin updates assignments" ON public.association_role_assignments
  FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- Nominations
CREATE POLICY "nominations visible to association" ON public.leadership_nominations
  FOR SELECT TO authenticated USING (
    submitted_by = auth.uid()
    OR nominee_user_id = auth.uid()
    OR public.has_assoc_permission(auth.uid(), association_id, 'executives.view')
    OR public.is_super_admin(auth.uid())
  );
CREATE POLICY "officers submit nominations" ON public.leadership_nominations
  FOR INSERT TO authenticated WITH CHECK (
    submitted_by = auth.uid()
    AND status = 'submitted'
    AND (
      public.has_assoc_permission(auth.uid(), association_id, 'executives.nominate')
      OR EXISTS (SELECT 1 FROM public.associations a WHERE a.id = association_id AND a.created_by = auth.uid())
    )
  );
CREATE POLICY "super admin decides nominations" ON public.leadership_nominations
  FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- Financial accounts: only holders of bank_details.view
CREATE POLICY "bank details view" ON public.association_financial_accounts
  FOR SELECT TO authenticated USING (public.has_assoc_permission(auth.uid(), association_id, 'bank_details.view'));
CREATE POLICY "super admin writes bank details" ON public.association_financial_accounts
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "super admin updates bank details" ON public.association_financial_accounts
  FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- Approval requests
CREATE POLICY "approval requests visible" ON public.approval_requests
  FOR SELECT TO authenticated USING (
    requested_by = auth.uid() OR public.has_assoc_permission(auth.uid(), association_id, 'approvals.view')
  );
CREATE POLICY "officers raise approval requests" ON public.approval_requests
  FOR INSERT TO authenticated WITH CHECK (
    requested_by = auth.uid() AND status = 'pending'
    AND public.has_assoc_permission(auth.uid(), association_id, 'approvals.request')
  );
CREATE POLICY "checkers decide approval requests" ON public.approval_requests
  FOR UPDATE TO authenticated
  USING (public.has_assoc_permission(auth.uid(), association_id, 'approvals.approve') AND requested_by <> auth.uid())
  WITH CHECK (public.has_assoc_permission(auth.uid(), association_id, 'approvals.approve') AND requested_by <> auth.uid());

-- ============ TRIGGERS ============
CREATE TRIGGER trg_associations_updated BEFORE UPDATE ON public.associations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_memberships_updated BEFORE UPDATE ON public.association_memberships FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_terms_updated BEFORE UPDATE ON public.executive_terms FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_assignments_updated BEFORE UPDATE ON public.association_role_assignments FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_nominations_updated BEFORE UPDATE ON public.leadership_nominations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_fin_accounts_updated BEFORE UPDATE ON public.association_financial_accounts FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_approval_requests_updated BEFORE UPDATE ON public.approval_requests FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ SEED CATALOGUE ============
INSERT INTO public.permissions (key, description, sensitive) VALUES
  ('association.view','View association profile',false),
  ('association.manage','Edit association profile and settings',true),
  ('members.view','View member list',false),
  ('members.manage','Approve, suspend or remove members',true),
  ('executives.view','View executives and tenure history',false),
  ('executives.nominate','Submit executive nominations',true),
  ('finance.view','View association financial overview',false),
  ('finance.export','Export financial data',true),
  ('dues.view','View dues and payment requests',false),
  ('dues.manage','Create and manage dues/payment requests',true),
  ('transactions.view','View transaction history',false),
  ('receipts.view','View issued receipts',false),
  ('settlement.view','View settlements and status',false),
  ('settlement.request','Request a settlement payout',true),
  ('settlement.approve','Approve a settlement payout',true),
  ('bank_details.view','View association settlement account',true),
  ('bank_details.change_request','Request a change to bank details',true),
  ('reports.view','View reconciliation and revenue reports',false),
  ('reports.export','Export reports',true),
  ('approvals.view','View pending approval requests',false),
  ('approvals.request','Raise approval requests',true),
  ('approvals.approve','Approve requests raised by others',true),
  ('audit.view','View association audit log',false);

INSERT INTO public.association_roles (key, name, description, is_head, sort_order) VALUES
  ('president','President / Head','Recognised head of the association, appointed by UniEgo Super Admin',true,10),
  ('treasurer','Treasurer','Initiates financial operations and manages dues',false,20),
  ('financial_secretary','Financial Secretary','Maintains financial records and reporting',false,30),
  ('staff_adviser','Staff Adviser','Institutional oversight of association finances',false,40),
  ('secretary','General Secretary','Administrative records and membership',false,50),
  ('auditor','Internal Auditor','Independent review of records',false,60);

INSERT INTO public.role_permissions (role_key, permission_key) VALUES
  ('president','association.view'),('president','association.manage'),('president','members.view'),('president','members.manage'),
  ('president','executives.view'),('president','executives.nominate'),('president','finance.view'),('president','finance.export'),
  ('president','dues.view'),('president','dues.manage'),('president','transactions.view'),('president','receipts.view'),
  ('president','settlement.view'),('president','settlement.approve'),('president','bank_details.view'),
  ('president','reports.view'),('president','reports.export'),('president','approvals.view'),('president','approvals.approve'),('president','audit.view'),

  ('treasurer','association.view'),('treasurer','members.view'),('treasurer','executives.view'),
  ('treasurer','finance.view'),('treasurer','finance.export'),('treasurer','dues.view'),('treasurer','dues.manage'),
  ('treasurer','transactions.view'),('treasurer','receipts.view'),('treasurer','settlement.view'),('treasurer','settlement.request'),
  ('treasurer','bank_details.view'),('treasurer','bank_details.change_request'),('treasurer','reports.view'),('treasurer','reports.export'),
  ('treasurer','approvals.view'),('treasurer','approvals.request'),

  ('financial_secretary','association.view'),('financial_secretary','members.view'),('financial_secretary','executives.view'),
  ('financial_secretary','finance.view'),('financial_secretary','dues.view'),('financial_secretary','transactions.view'),
  ('financial_secretary','receipts.view'),('financial_secretary','settlement.view'),('financial_secretary','reports.view'),
  ('financial_secretary','reports.export'),('financial_secretary','approvals.view'),('financial_secretary','approvals.request'),

  ('staff_adviser','association.view'),('staff_adviser','members.view'),('staff_adviser','executives.view'),
  ('staff_adviser','finance.view'),('staff_adviser','dues.view'),('staff_adviser','transactions.view'),
  ('staff_adviser','receipts.view'),('staff_adviser','settlement.view'),('staff_adviser','reports.view'),
  ('staff_adviser','approvals.view'),('staff_adviser','audit.view'),

  ('secretary','association.view'),('secretary','members.view'),('secretary','members.manage'),('secretary','executives.view'),('secretary','dues.view'),

  ('auditor','association.view'),('auditor','finance.view'),('auditor','transactions.view'),('auditor','receipts.view'),
  ('auditor','settlement.view'),('auditor','reports.view'),('auditor','audit.view');