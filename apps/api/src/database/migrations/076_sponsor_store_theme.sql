-- Storefront theming: flexible JSON so partners can deeply customize their shop UI
ALTER TABLE platform_sponsors
  ADD COLUMN IF NOT EXISTS store_theme JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS secondary_color TEXT,
  ADD COLUMN IF NOT EXISTS accent_color TEXT,
  ADD COLUMN IF NOT EXISTS favicon_url TEXT;

COMMENT ON COLUMN platform_sponsors.store_theme IS
  'Partner storefront theme: colors, fonts, layout, hero, toggles (JSON)';
