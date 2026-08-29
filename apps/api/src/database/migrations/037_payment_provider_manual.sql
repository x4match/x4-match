-- Proveedor para pagos marcados a mano por el organizador (efectivo / transferencia).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_provider' AND e.enumlabel = 'MANUAL'
  ) THEN
    ALTER TYPE payment_provider ADD VALUE 'MANUAL';
  END IF;
END $$;
