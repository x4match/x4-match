CREATE TYPE club_billing_status AS ENUM (
  'NOT_STARTED',
  'TRIAL',
  'ACTIVE',
  'GRACE',
  'SUSPENDED',
  'CANCELLED'
);

CREATE TYPE club_trial_mode AS ENUM ('TIME', 'MANUAL');

CREATE TABLE IF NOT EXISTS club_billing (
  club_id UUID PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
  status club_billing_status NOT NULL DEFAULT 'NOT_STARTED',
  trial_mode club_trial_mode,
  trial_started_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  trial_days INT NOT NULL DEFAULT 90,
  activated_at TIMESTAMPTZ,
  grace_ends_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  ops_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_billing_status ON club_billing (status);
CREATE INDEX IF NOT EXISTS idx_club_billing_trial_ends ON club_billing (trial_ends_at)
  WHERE status = 'TRIAL';
