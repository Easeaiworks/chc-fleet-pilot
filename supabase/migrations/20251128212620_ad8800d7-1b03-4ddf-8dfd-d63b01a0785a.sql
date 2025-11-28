-- Create profiles table for user management
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create branches table
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view branches"
  ON public.branches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage branches"
  ON public.branches FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create vehicles table
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vin TEXT NOT NULL UNIQUE,
  plate TEXT NOT NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  make TEXT,
  model TEXT,
  year INTEGER,
  odometer_km INTEGER DEFAULT 0,
  last_oil_change_km INTEGER,
  last_tire_change_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view vehicles"
  ON public.vehicles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage vehicles"
  ON public.vehicles FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create expense categories table
CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('maintenance', 'repair')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view categories"
  ON public.expense_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage categories"
  ON public.expense_categories FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert default categories
INSERT INTO public.expense_categories (name, type) VALUES
  ('Oil Change', 'maintenance'),
  ('Tire Replacement', 'maintenance'),
  ('Brake Service', 'maintenance'),
  ('Air Filter', 'maintenance'),
  ('Transmission Repair', 'repair'),
  ('Engine Repair', 'repair'),
  ('Suspension Repair', 'repair'),
  ('Electrical Repair', 'repair');

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  odometer_reading INTEGER,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view expenses"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage expenses"
  ON public.expenses FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create documents table for invoice uploads
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view documents"
  ON public.documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage documents"
  ON public.documents FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('vehicle-documents', 'vehicle-documents', false);

-- Storage policies
CREATE POLICY "Authenticated users can upload documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'vehicle-documents');

CREATE POLICY "Authenticated users can view documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'vehicle-documents');

CREATE POLICY "Authenticated users can delete documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'vehicle-documents');

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();