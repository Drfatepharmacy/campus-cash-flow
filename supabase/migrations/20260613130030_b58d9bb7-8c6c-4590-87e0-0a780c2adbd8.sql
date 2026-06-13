
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin','student','department_rep','faculty_rep','bank_runner');
CREATE TYPE public.txn_status AS ENUM ('pending','paid','failed','refunded');
CREATE TYPE public.settlement_status AS ENUM ('pending','assigned','in_progress','deposited','confirmed','flagged');

-- updated_at trigger fn
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- CAMPUSES
CREATE TABLE public.campuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  short_name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.campuses TO anon, authenticated;
GRANT ALL ON public.campuses TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.campuses TO authenticated;
ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER campuses_updated BEFORE UPDATE ON public.campuses FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- FACULTIES
CREATE TABLE public.faculties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id uuid NOT NULL REFERENCES public.campuses(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campus_id, name)
);
GRANT SELECT ON public.faculties TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.faculties TO authenticated;
GRANT ALL ON public.faculties TO service_role;
ALTER TABLE public.faculties ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER faculties_updated BEFORE UPDATE ON public.faculties FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- DEPARTMENTS
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL REFERENCES public.faculties(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(faculty_id, name)
);
GRANT SELECT ON public.departments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER departments_updated BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  phone text,
  matric_no text UNIQUE,
  campus_id uuid REFERENCES public.campuses(id),
  faculty_id uuid REFERENCES public.faculties(id),
  department_id uuid REFERENCES public.departments(id),
  level int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- USER_ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- handle_new_user trigger: auto-create profile + default student role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student')
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PAYMENT REQUESTS
CREATE TABLE public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id uuid NOT NULL REFERENCES public.campuses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  base_amount numeric(12,2) NOT NULL CHECK (base_amount > 0),
  target_faculty_id uuid REFERENCES public.faculties(id),
  target_department_id uuid REFERENCES public.departments(id),
  target_level int,
  opens_at timestamptz,
  closes_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_requests TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.payment_requests TO authenticated;
GRANT ALL ON public.payment_requests TO service_role;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER payment_requests_updated BEFORE UPDATE ON public.payment_requests FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- SERVICE CHARGE RULES
CREATE TABLE public.service_charge_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'global' CHECK (scope IN ('global','department','payment_request')),
  department_id uuid REFERENCES public.departments(id),
  payment_request_id uuid REFERENCES public.payment_requests(id) ON DELETE CASCADE,
  tiers jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.service_charge_rules TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.service_charge_rules TO authenticated;
GRANT ALL ON public.service_charge_rules TO service_role;
ALTER TABLE public.service_charge_rules ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER scr_updated BEFORE UPDATE ON public.service_charge_rules FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- TRANSACTIONS
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_request_id uuid NOT NULL REFERENCES public.payment_requests(id),
  base_amount numeric(12,2) NOT NULL,
  service_charge numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL,
  status public.txn_status NOT NULL DEFAULT 'pending',
  paystack_ref text,
  paystack_response jsonb,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER txn_updated BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_txn_student ON public.transactions(student_id);
CREATE INDEX idx_txn_status ON public.transactions(status);

-- RECEIPTS
CREATE TABLE public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL UNIQUE REFERENCES public.transactions(id) ON DELETE CASCADE,
  qr_token text NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.receipts TO authenticated;
GRANT ALL ON public.receipts TO service_role;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- AUDIT LOGS
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  entity text,
  entity_id text,
  metadata jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- SETTLEMENTS (stub schema for phase 2)
CREATE TABLE public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  department_id uuid REFERENCES public.departments(id),
  amount numeric(12,2) NOT NULL,
  status public.settlement_status NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.settlements TO authenticated;
GRANT ALL ON public.settlements TO service_role;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER settlements_updated BEFORE UPDATE ON public.settlements FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.deposit_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  settlement_id uuid REFERENCES public.settlements(id) ON DELETE CASCADE,
  runner_id uuid REFERENCES auth.users(id),
  status public.settlement_status NOT NULL DEFAULT 'assigned',
  deposit_slip_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.deposit_jobs TO authenticated;
GRANT ALL ON public.deposit_jobs TO service_role;
ALTER TABLE public.deposit_jobs ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER dj_updated BEFORE UPDATE ON public.deposit_jobs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- POLICIES
-- campuses, faculties, departments: read all signed-in + anon; admin manages
CREATE POLICY "campuses_read_all" ON public.campuses FOR SELECT USING (true);
CREATE POLICY "campuses_admin_write" ON public.campuses FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "campuses_admin_update" ON public.campuses FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "campuses_admin_delete" ON public.campuses FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "faculties_read_all" ON public.faculties FOR SELECT USING (true);
CREATE POLICY "faculties_admin_write" ON public.faculties FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "faculties_admin_update" ON public.faculties FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "faculties_admin_delete" ON public.faculties FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "departments_read_all" ON public.departments FOR SELECT USING (true);
CREATE POLICY "departments_admin_write" ON public.departments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "departments_admin_update" ON public.departments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "departments_admin_delete" ON public.departments FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- profiles
CREATE POLICY "profiles_self_read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));

-- user_roles
CREATE POLICY "roles_self_read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles_admin_write" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles_admin_delete" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- payment requests
CREATE POLICY "pr_read_signed" ON public.payment_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "pr_admin_write" ON public.payment_requests FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "pr_admin_update" ON public.payment_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "pr_admin_delete" ON public.payment_requests FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- service charge rules
CREATE POLICY "scr_read" ON public.service_charge_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "scr_admin_write" ON public.service_charge_rules FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "scr_admin_update" ON public.service_charge_rules FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "scr_admin_delete" ON public.service_charge_rules FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- transactions
CREATE POLICY "txn_self_read" ON public.transactions FOR SELECT TO authenticated USING (student_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "txn_self_insert" ON public.transactions FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY "txn_admin_update" ON public.transactions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- receipts
CREATE POLICY "receipt_self_read" ON public.receipts FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND (t.student_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
);

-- audit logs
CREATE POLICY "audit_admin_read" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- settlements / deposit_jobs
CREATE POLICY "settlements_admin_all" ON public.settlements FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "deposit_jobs_admin_all" ON public.deposit_jobs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR runner_id = auth.uid()) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- SEED
INSERT INTO public.campuses (name, slug, short_name) VALUES ('University of Benin','uniben','UNIBEN');

-- Seed a default service charge rule (global tiered)
INSERT INTO public.service_charge_rules (scope, tiers) VALUES (
  'global',
  '[{"max":5000,"type":"flat","value":250},{"max":20000,"type":"flat","value":500},{"max":null,"type":"percent","value":3}]'::jsonb
);
