-- Usuario de solo lectura para el datasource PostgreSQL de Grafana Cloud.
-- Correr en el SQL Editor de Neon como el owner de la base (neondb_owner), cambiando la contraseña.
-- Sin acceso a contraseñas, tokens ni credenciales de pago.

CREATE ROLE grafana_reader WITH LOGIN PASSWORD 'CAMBIAR-POR-UNA-CONTRASEÑA-LARGA';
ALTER ROLE grafana_reader SET statement_timeout = '20s';
ALTER ROLE grafana_reader SET default_transaction_read_only = on;

GRANT USAGE ON SCHEMA public TO grafana_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO grafana_reader;

REVOKE SELECT ON
  password_reset_tokens,
  email_verification_tokens,
  user_push_tokens,
  club_payment_config,
  platform_sponsor_payment_config
FROM grafana_reader;

REVOKE SELECT ON users FROM grafana_reader;
GRANT SELECT (
  id, email, name, role, created_at, updated_at, verification_status, email_verified_at,
  last_seen_at, last_platform, last_app_version
) ON users TO grafana_reader;

REVOKE SELECT ON platform_sponsors FROM grafana_reader;
GRANT SELECT (
  id, name, slug, active, verified, verified_at, suspended_at, catalog_mode, created_at, updated_at
) ON platform_sponsors TO grafana_reader;
