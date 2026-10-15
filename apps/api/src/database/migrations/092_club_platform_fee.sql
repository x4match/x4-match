-- Modelo transaccional: comisión de la plataforma por club, configurable desde el backoffice.
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS platform_fee_percent NUMERIC(5, 2) NOT NULL DEFAULT 0
    CHECK (platform_fee_percent >= 0 AND platform_fee_percent <= 30);

COMMENT ON COLUMN clubs.platform_fee_percent IS
  'Porcentaje que retiene x4 Match sobre cada cobro online (marketplace_fee de Mercado Pago).';

-- Monto efectivamente retenido en cada cobro, para reportes y conciliación.
ALTER TABLE match_deposits
  ADD COLUMN IF NOT EXISTS platform_fee_amount NUMERIC(10, 2);
