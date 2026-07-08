
-- ============================================================
-- Drop previous sample + commission tables
-- ============================================================
DROP TABLE IF EXISTS public.commission_records CASCADE;
DROP TABLE IF EXISTS public.commission_audit_log CASCADE;
DROP TABLE IF EXISTS public.commission_settings CASCADE;
DROP TABLE IF EXISTS public.payrolls CASCADE;
DROP TABLE IF EXISTS public.invoice_items CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.stylists CASCADE;
DROP TABLE IF EXISTS public.assistants CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;

-- ============================================================
-- Salon app schema (mirrors user's real DB)
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('admin','customer','staff','stylist');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- profiles ---------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  phone TEXT,
  name TEXT,
  avatar_url TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles read own or admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles update own or admin" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- packages (with commission category) -----------------------
CREATE TABLE public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_sessions INTEGER NOT NULL DEFAULT 1,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  category TEXT NOT NULL DEFAULT 'package'
    CHECK (category IN ('service','product','package','ginseng_box','freedom')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packages TO authenticated;
GRANT ALL ON public.packages TO service_role;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "packages read auth" ON public.packages FOR SELECT TO authenticated USING (true);
CREATE POLICY "packages admin write" ON public.packages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- customer_packages -----------------------------------------
CREATE TABLE public.customer_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE RESTRICT,
  sessions_remaining INTEGER NOT NULL,
  total_sessions INTEGER NOT NULL,
  deposit_paid BOOLEAN NOT NULL DEFAULT FALSE,
  deposit_paid_at TIMESTAMPTZ,
  deposit_sessions_paid INTEGER NOT NULL DEFAULT 0,
  warranty_years INTEGER NOT NULL DEFAULT 0,
  warranty_expires_at TIMESTAMPTZ,
  purchase_date TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_packages TO authenticated;
GRANT ALL ON public.customer_packages TO service_role;
ALTER TABLE public.customer_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cust_pkg admin read" ON public.customer_packages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- usage_logs ------------------------------------------------
CREATE TABLE public.usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_package_id UUID NOT NULL REFERENCES public.customer_packages(id) ON DELETE CASCADE,
  admin_id UUID,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.usage_logs TO authenticated;
GRANT ALL ON public.usage_logs TO service_role;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_logs admin read" ON public.usage_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- session_staff ---------------------------------------------
CREATE TABLE public.session_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_log_id UUID NOT NULL REFERENCES public.usage_logs(id) ON DELETE CASCADE,
  staff_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usage_log_id, staff_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_staff TO authenticated;
GRANT ALL ON public.session_staff TO service_role;
ALTER TABLE public.session_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "session_staff admin read" ON public.session_staff FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX session_staff_staff_idx ON public.session_staff(staff_user_id);
CREATE INDEX session_staff_log_idx ON public.session_staff(usage_log_id);

-- promotions ------------------------------------------------
CREATE TABLE public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage','fixed')),
  discount_value NUMERIC NOT NULL CHECK (discount_value >= 0),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promotions read" ON public.promotions FOR SELECT TO authenticated USING (true);

CREATE TABLE public.package_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (promotion_id, package_id)
);
GRANT SELECT ON public.package_promotions TO authenticated;
GRANT ALL ON public.package_promotions TO service_role;
ALTER TABLE public.package_promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pkg_promo read" ON public.package_promotions FOR SELECT TO authenticated USING (true);

-- ============================================================
-- Commission module tables
-- ============================================================
CREATE TABLE public.commission_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL UNIQUE
    CHECK (category IN ('service','product','package','ginseng_box','freedom')),
  stylist_percent NUMERIC(6,3) NOT NULL DEFAULT 0,
  staff_percent NUMERIC(6,3) NOT NULL DEFAULT 0,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.commission_settings TO authenticated;
GRANT ALL ON public.commission_settings TO service_role;
ALTER TABLE public.commission_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings admin all" ON public.commission_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.commission_settings (category, stylist_percent, staff_percent) VALUES
  ('service', 7, 3),
  ('product', 3.75, 3.75),
  ('package', 2.5, 2.5),
  ('ginseng_box', 5, 5),
  ('freedom', 5, 5);

CREATE TABLE public.commission_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('sale','session')),
  customer_package_id UUID,
  usage_log_id UUID,
  employee_id UUID NOT NULL,
  employee_role TEXT NOT NULL CHECK (employee_role IN ('stylist','staff')),
  category TEXT NOT NULL,
  sale_amount NUMERIC(12,2) NOT NULL,
  commission_percent NUMERIC(6,3) NOT NULL,
  commission_amount NUMERIC(12,2) NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX commission_records_unique_sale
  ON public.commission_records(customer_package_id, employee_id, employee_role)
  WHERE source_type = 'sale';
CREATE UNIQUE INDEX commission_records_unique_session
  ON public.commission_records(usage_log_id, employee_id, employee_role)
  WHERE source_type = 'session';
CREATE INDEX commission_records_emp_date ON public.commission_records(employee_id, event_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_records TO authenticated;
GRANT ALL ON public.commission_records TO service_role;
ALTER TABLE public.commission_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "records admin all" ON public.commission_records FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.payrolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  employee_role TEXT NOT NULL,
  month INT NOT NULL,
  year INT NOT NULL,
  total_commission NUMERIC(12,2) NOT NULL DEFAULT 0,
  bonus NUMERIC(12,2) NOT NULL DEFAULT 0,
  deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid')),
  payment_date TIMESTAMPTZ,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, employee_role, month, year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payrolls TO authenticated;
GRANT ALL ON public.payrolls TO service_role;
ALTER TABLE public.payrolls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payrolls admin all" ON public.payrolls FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.commission_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  action TEXT NOT NULL,
  category TEXT,
  old_stylist_percent NUMERIC(6,3),
  old_staff_percent NUMERIC(6,3),
  new_stylist_percent NUMERIC(6,3),
  new_staff_percent NUMERIC(6,3),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.commission_audit_log TO authenticated;
GRANT ALL ON public.commission_audit_log TO service_role;
ALTER TABLE public.commission_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit admin read" ON public.commission_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "audit admin insert" ON public.commission_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- Restore admin role + profile for existing admin@salon.com
-- ============================================================
INSERT INTO public.profiles (id, email, name)
SELECT id, email, 'Admin' FROM auth.users WHERE email = 'admin@salon.com'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'admin@salon.com'
ON CONFLICT DO NOTHING;
