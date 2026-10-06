-- Devolución de la inscripción cuando una pareja se baja con al menos 24 h de anticipación.
-- La inscripción se borra al darse de baja; la devolución queda registrada en tournament_refunds
-- para que el organizador vea qué transferencias tiene que devolver.

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS refund_on_withdraw BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE tournament_registrations
  ADD COLUMN IF NOT EXISTS payment_provider_payment_id TEXT;

CREATE TABLE IF NOT EXISTS tournament_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  registration_id UUID,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  player1_name TEXT NOT NULL,
  player2_name TEXT NOT NULL,
  phone TEXT,
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'ARS',
  provider payment_provider,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REFUNDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  refunded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tournament_refunds_tournament
  ON tournament_refunds (tournament_id, status);
