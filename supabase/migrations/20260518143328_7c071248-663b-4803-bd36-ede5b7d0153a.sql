DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'operations_role' AND e.enumlabel = 'super_admin'
  ) THEN
    ALTER TYPE public.operations_role ADD VALUE 'super_admin';
  END IF;
END$$;