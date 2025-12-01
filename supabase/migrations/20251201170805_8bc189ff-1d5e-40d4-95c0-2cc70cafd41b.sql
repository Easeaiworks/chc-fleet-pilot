CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'manager', 'staff')),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'complete')),
  ADD COLUMN IF NOT EXISTS modified_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS modified_at timestamp with time zone;

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;