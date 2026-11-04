-- Comisión por defecto de x4 match sobre cobros online: 0.8%.
-- Los clubes que seguían en 0% (default anterior) pasan a 0.8%.
-- Los que ya tienen un valor custom (distinto de 0) no se tocan.

UPDATE clubs
SET platform_fee_percent = 0.8,
    updated_at = NOW()
WHERE platform_fee_percent = 0;

ALTER TABLE clubs
  ALTER COLUMN platform_fee_percent SET DEFAULT 0.8;

COMMENT ON COLUMN clubs.platform_fee_percent IS
  'Porcentaje que retiene x4 Match sobre cada cobro online (marketplace_fee de Mercado Pago). Default 0.8%.';
