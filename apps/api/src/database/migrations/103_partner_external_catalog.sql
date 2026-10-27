-- Catálogo externo de partners (p. ej. Tienda Nube): mirror en app + deep link a su tienda.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sponsor_catalog_mode') THEN
    CREATE TYPE sponsor_catalog_mode AS ENUM ('NATIVE', 'EXTERNAL_LINK');
  END IF;
END $$;

ALTER TABLE platform_sponsors
  ADD COLUMN IF NOT EXISTS catalog_mode sponsor_catalog_mode NOT NULL DEFAULT 'NATIVE',
  ADD COLUMN IF NOT EXISTS external_store_url TEXT,
  ADD COLUMN IF NOT EXISTS tienda_nube_store_id TEXT,
  ADD COLUMN IF NOT EXISTS tienda_nube_access_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS catalog_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS catalog_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS catalog_sync_error TEXT,
  ADD COLUMN IF NOT EXISTS catalog_sync_product_count INT NOT NULL DEFAULT 0;

ALTER TABLE platform_products
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_products_external_uid
  ON platform_products (sponsor_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_platform_sponsors_catalog_sync
  ON platform_sponsors (catalog_sync_enabled, catalog_mode)
  WHERE catalog_sync_enabled = TRUE AND catalog_mode = 'EXTERNAL_LINK';
