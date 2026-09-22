-- Métodos de cobro de inscripción del torneo (transferencia / Mercado Pago)
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS accept_transfer BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS accept_mercadopago BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS transfer_cbu TEXT,
  ADD COLUMN IF NOT EXISTS transfer_alias TEXT,
  ADD COLUMN IF NOT EXISTS transfer_holder_name TEXT;

COMMENT ON COLUMN tournaments.accept_transfer IS
  'Si true, los jugadores pueden pagar por transferencia bancaria';
COMMENT ON COLUMN tournaments.accept_mercadopago IS
  'Si true, los jugadores pueden pagar con Mercado Pago';
COMMENT ON COLUMN tournaments.transfer_cbu IS
  'CBU/CVU para transferencia (si accept_transfer)';
COMMENT ON COLUMN tournaments.transfer_alias IS
  'Alias CBU para transferencia (si accept_transfer)';
COMMENT ON COLUMN tournaments.transfer_holder_name IS
  'Titular de la cuenta para transferencia';
