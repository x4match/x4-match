ALTER TABLE circuit_categories
  ADD COLUMN IF NOT EXISTS gender TEXT;

ALTER TABLE circuit_categories
  DROP CONSTRAINT IF EXISTS circuit_categories_circuit_id_label_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_circuit_categories_circuit_label_gender
  ON circuit_categories (circuit_id, label, COALESCE(gender, ''));
