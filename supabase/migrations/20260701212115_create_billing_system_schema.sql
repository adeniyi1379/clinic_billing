/*
# Hospital Billing & Receipt Management System — Initial Schema

## Purpose
Creates the complete database schema for a hospital billing and receipt management
system. The system is multi-user with role-based access control (RBAC). All staff
must sign in; there is no anonymous access.

## New Tables

1. `staff` — staff profiles linked to Supabase auth.users. Stores role, full name,
   and active status. One row per auth user.
   - `id` (uuid, PK, references auth.users)
   - `full_name` (text, not null)
   - `role` (text, not null, check in administrator/cashier/receptionist/accountant)
   - `is_active` (boolean, default true)
   - `created_at` (timestamptz, default now())

2. `hospital_settings` — single-row table holding hospital identity printed on
   receipts. Seeded with defaults so receipts work immediately.

3. `services` — billable services offered by the hospital.

4. `transactions` — a single billing event for one customer.

5. `transaction_items` — line items belonging to a transaction.

6. `audit_log` — append-only log of important actions.

## Functions / Triggers

- `handle_new_user()` — trigger on auth.users INSERT; creates a staff row. First
  user becomes administrator; subsequent users become receptionist.
- `generate_receipt_number()` — trigger on transactions INSERT; builds a receipt
  number from hospital_settings.receipt_prefix + year + zero-padded sequence.
- `update_updated_at_column()` — sets updated_at = now() on row update.

## Security (RLS)

All tables have RLS enabled. Policies use helper functions that read the signed-in
user's role from the staff table. See inline comments for each policy.

## Important Notes

1. The first user to sign up becomes the administrator. Subsequent sign-ups default
   to 'receptionist' and can be promoted by an admin via User Management.
2. Receipt numbers are generated server-side by the trigger.
3. All money columns use numeric(12,2) to avoid floating-point rounding errors.
*/

-- ============================================================
-- staff table (created first so helper functions can reference it)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.staff (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('administrator', 'cashier', 'receptionist', 'accountant')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Helper functions (depend on staff table existing)
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_staff_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT s.role FROM public.staff s WHERE s.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.id = auth.uid() AND s.role = 'administrator'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_admin_or_accountant()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.id = auth.uid() AND s.role IN ('administrator', 'accountant')
  );
$$;

-- ============================================================
-- Enable RLS on staff and add policies
-- ============================================================
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_own_or_admin" ON public.staff;
CREATE POLICY "staff_select_own_or_admin" ON public.staff
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_current_user_admin());

DROP POLICY IF EXISTS "staff_insert_admin_only" ON public.staff;
CREATE POLICY "staff_insert_admin_only" ON public.staff
  FOR INSERT TO authenticated
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "staff_update_admin_only" ON public.staff;
CREATE POLICY "staff_update_admin_only" ON public.staff
  FOR UPDATE TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "staff_delete_admin_only" ON public.staff;
CREATE POLICY "staff_delete_admin_only" ON public.staff
  FOR DELETE TO authenticated
  USING (public.is_current_user_admin());

-- ============================================================
-- handle_new_user trigger: creates a staff row on auth.users INSERT.
-- First user becomes administrator; subsequent users become receptionist.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role text;
  signup_name text;
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM public.staff) THEN 'administrator' ELSE 'receptionist' END
  INTO assigned_role;

  signup_name := COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));

  INSERT INTO public.staff (id, full_name, role, is_active)
  VALUES (new.id, signup_name, assigned_role, true);

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- hospital_settings table (single-row)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hospital_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name text NOT NULL DEFAULT 'City General Hospital',
  address text DEFAULT '123 Health Avenue, Lagos',
  phone text DEFAULT '+234 800 000 0000',
  email text DEFAULT 'info@citygeneralhospital.com',
  website text DEFAULT '',
  logo_url text DEFAULT '',
  currency_symbol text NOT NULL DEFAULT '₦',
  receipt_prefix text NOT NULL DEFAULT 'RCP',
  footer_message text NOT NULL DEFAULT 'Thank you for choosing our hospital. We wish you good health.',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.hospital_settings (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.hospital_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select_all_staff" ON public.hospital_settings;
CREATE POLICY "settings_select_all_staff" ON public.hospital_settings
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "settings_update_admin_only" ON public.hospital_settings;
CREATE POLICY "settings_update_admin_only" ON public.hospital_settings
  FOR UPDATE TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- ============================================================
-- services table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  default_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (default_price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "services_select_all_staff" ON public.services;
CREATE POLICY "services_select_all_staff" ON public.services
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "services_insert_admin_only" ON public.services;
CREATE POLICY "services_insert_admin_only" ON public.services
  FOR INSERT TO authenticated
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "services_update_admin_only" ON public.services;
CREATE POLICY "services_update_admin_only" ON public.services
  FOR UPDATE TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "services_delete_admin_only" ON public.services;
CREATE POLICY "services_delete_admin_only" ON public.services
  FOR DELETE TO authenticated
  USING (public.is_current_user_admin());

-- ============================================================
-- transactions table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text UNIQUE NOT NULL,
  customer_name text NOT NULL,
  card_number text DEFAULT '',
  phone_number text DEFAULT '',
  subtotal numeric(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  grand_total numeric(12,2) NOT NULL DEFAULT 0 CHECK (grand_total >= 0),
  amount_paid numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  outstanding_balance numeric(12,2) NOT NULL DEFAULT 0 CHECK (outstanding_balance >= 0),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'pos', 'bank_transfer', 'mobile_transfer')),
  payment_status text NOT NULL CHECK (payment_status IN ('paid', 'partial', 'unpaid')),
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  staff_name text NOT NULL,
  transaction_date timestamptz NOT NULL DEFAULT now(),
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_receipt_number ON public.transactions(receipt_number);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_name ON public.transactions(customer_name);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_date ON public.transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_method ON public.transactions(payment_method);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON public.transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_transactions_staff_id ON public.transactions(staff_id);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions_select_all_staff" ON public.transactions;
CREATE POLICY "transactions_select_all_staff" ON public.transactions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "transactions_insert_all_staff" ON public.transactions;
CREATE POLICY "transactions_insert_all_staff" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = staff_id);

DROP POLICY IF EXISTS "transactions_update_admin_or_accountant" ON public.transactions;
CREATE POLICY "transactions_update_admin_or_accountant" ON public.transactions
  FOR UPDATE TO authenticated
  USING (public.is_current_user_admin_or_accountant())
  WITH CHECK (public.is_current_user_admin_or_accountant());

DROP POLICY IF EXISTS "transactions_delete_admin_or_accountant" ON public.transactions;
CREATE POLICY "transactions_delete_admin_or_accountant" ON public.transactions
  FOR DELETE TO authenticated
  USING (public.is_current_user_admin_or_accountant());

-- ============================================================
-- transaction_items table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transaction_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  service_name text NOT NULL,
  description text DEFAULT '',
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON public.transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_service_id ON public.transaction_items(service_id);

ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transaction_items_select_all_staff" ON public.transaction_items;
CREATE POLICY "transaction_items_select_all_staff" ON public.transaction_items
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "transaction_items_insert_all_staff" ON public.transaction_items;
CREATE POLICY "transaction_items_insert_all_staff" ON public.transaction_items
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "transaction_items_update_admin_or_accountant" ON public.transaction_items;
CREATE POLICY "transaction_items_update_admin_or_accountant" ON public.transaction_items
  FOR UPDATE TO authenticated
  USING (public.is_current_user_admin_or_accountant())
  WITH CHECK (public.is_current_user_admin_or_accountant());

DROP POLICY IF EXISTS "transaction_items_delete_admin_or_accountant" ON public.transaction_items;
CREATE POLICY "transaction_items_delete_admin_or_accountant" ON public.transaction_items
  FOR DELETE TO authenticated
  USING (public.is_current_user_admin_or_accountant());

-- ============================================================
-- audit_log table (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  staff_name text DEFAULT '',
  action text NOT NULL,
  entity_type text DEFAULT '',
  entity_id text DEFAULT '',
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_staff_id ON public.audit_log(staff_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_select_all_staff" ON public.audit_log;
CREATE POLICY "audit_log_select_all_staff" ON public.audit_log
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "audit_log_insert_all_staff" ON public.audit_log;
CREATE POLICY "audit_log_insert_all_staff" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================
-- updated_at trigger helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_services ON public.services;
CREATE TRIGGER set_updated_at_services
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_hospital_settings ON public.hospital_settings;
CREATE TRIGGER set_updated_at_hospital_settings
  BEFORE UPDATE ON public.hospital_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Receipt number generator trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefix text;
  current_year int;
  year_str text;
  seq int;
  new_number text;
BEGIN
  SELECT receipt_prefix INTO prefix FROM public.hospital_settings WHERE id = 1;
  IF prefix IS NULL THEN
    prefix := 'RCP';
  END IF;

  current_year := EXTRACT(YEAR FROM NEW.transaction_date);
  year_str := current_year::text;

  SELECT COALESCE(MAX(
    COALESCE(
      NULLIF(
        regexp_replace(
          split_part(receipt_number, '-', 3),
          '[^0-9]', '', 'g'
        ),
        ''
      )::int,
      0
    )
  ), 0) + 1
  INTO seq
  FROM public.transactions
  WHERE EXTRACT(YEAR FROM transaction_date) = current_year;

  new_number := prefix || '-' || year_str || '-' || lpad(seq::text, 6, '0');

  NEW.receipt_number := new_number;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_receipt_number ON public.transactions;
CREATE TRIGGER set_receipt_number
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  WHEN (NEW.receipt_number IS NULL OR NEW.receipt_number = '')
  EXECUTE FUNCTION public.generate_receipt_number();

-- ============================================================
-- Seed default services
-- ============================================================
INSERT INTO public.services (name, description, default_price, is_active)
VALUES
  ('Consultation', 'General medical consultation with a physician', 5000.00, true),
  ('Medication', 'Prescribed medication dispensed to patient', 2500.00, true),
  ('Laboratory Test', 'Diagnostic laboratory investigation', 3000.00, true),
  ('Injection', 'Administered injection / vaccination', 1500.00, true),
  ('Dressing', 'Wound dressing and care', 1000.00, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Grant necessary privileges
-- ============================================================
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
