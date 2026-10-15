-- App de Mercado Pago (MP_APP_ID) con la que el club autorizó OAuth.
-- Si la plataforma cambia de app, las conexiones de la app anterior deben reconectarse.
ALTER TABLE club_payment_config
  ADD COLUMN IF NOT EXISTS mp_app_id TEXT;
