import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { decryptSecret, encryptSecret } from '../common/utils/token-crypto';
import { DatabaseService } from '../database/database.service';

export type ClubPaymentStatus = 'DISCONNECTED' | 'CONNECTED' | 'EXPIRED' | 'MANUAL_ONLY';

export type ClubPaymentStatusResponse = {
  clubId: string;
  status: ClubPaymentStatus;
  mpUserId: string | null;
  connectedAt: string | null;
  canCheckoutOnline: boolean;
  oauthConfigured: boolean;
  mockConnectAvailable: boolean;
  usesPlatformFallback: boolean;
};

type PaymentConfigRow = {
  club_id: string;
  mp_user_id: string | null;
  mp_access_token_encrypted: string | null;
  mp_refresh_token_encrypted: string | null;
  token_expires_at: Date | string | null;
  connected_at: Date | string | null;
  status: ClubPaymentStatus;
};

@Injectable()
export class ClubPaymentConfigService {
  private readonly logger = new Logger(ClubPaymentConfigService.name);

  constructor(private readonly db: DatabaseService) {}

  isOAuthConfigured(): boolean {
    return !!(
      process.env.MP_APP_ID?.trim() && process.env.MP_CLIENT_SECRET?.trim()
    );
  }

  hasPlatformFallbackToken(): boolean {
    return !!process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  }

  private publicApiBase(): string {
    return (process.env.API_PUBLIC_URL || process.env.APP_URL || 'http://localhost:5000').replace(
      /\/$/,
      '',
    );
  }

  private mobileDeepLinkBase(): string {
    return (process.env.MOBILE_APP_SCHEME || 'x4match').replace(/:\/\/?$/, '');
  }

  private webClubBase(): string {
    return (process.env.WEB_CLUB_URL || '').replace(/\/$/, '');
  }

  private oauthReturnBase(returnTo?: string): string {
    if (returnTo === 'web') {
      const web = this.webClubBase();
      if (web) return `${web}/pagos`;
    }
    return `${this.mobileDeepLinkBase()}://club-payments`;
  }

  private oauthRedirectUri(): string {
    if (process.env.MP_REDIRECT_URI?.trim()) {
      return process.env.MP_REDIRECT_URI.trim();
    }
    return `${this.publicApiBase()}/clubs/oauth/mercadopago/callback`;
  }

  private signOAuthState(payload: Record<string, unknown>): string {
    const secret = process.env.JWT_SECRET?.trim() || process.env.PAYMENT_TOKEN_ENCRYPTION_KEY?.trim();
    if (!secret) {
      throw new BadRequestException('OAuth no configurado en el servidor');
    }
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', secret).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  private verifyOAuthState(state: string): { clubId: string; userId: string; returnTo?: string } {
    const [body, sig] = state.split('.');
    if (!body || !sig) {
      throw new BadRequestException('Estado OAuth inválido');
    }
    const secret = process.env.JWT_SECRET?.trim() || process.env.PAYMENT_TOKEN_ENCRYPTION_KEY?.trim();
    if (!secret) {
      throw new BadRequestException('OAuth no configurado en el servidor');
    }
    const expected = createHmac('sha256', secret).update(body).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      throw new BadRequestException('Estado OAuth inválido');
    }
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      clubId?: string;
      userId?: string;
      exp?: number;
      returnTo?: string;
    };
    if (!parsed.clubId || !parsed.userId || !parsed.exp || parsed.exp < Date.now()) {
      throw new BadRequestException('Estado OAuth expirado o inválido');
    }
    return { clubId: parsed.clubId, userId: parsed.userId, returnTo: parsed.returnTo };
  }

  private mapStatus(row: PaymentConfigRow | null): ClubPaymentStatusResponse {
    const status = row?.status ?? 'DISCONNECTED';
    const oauthConfigured = this.isOAuthConfigured();
    const usesPlatformFallback =
      status !== 'CONNECTED' && this.hasPlatformFallbackToken() && status !== 'MANUAL_ONLY';

    return {
      clubId: row?.club_id ?? '',
      status,
      mpUserId: row?.mp_user_id ?? null,
      connectedAt: row?.connected_at ? new Date(row.connected_at).toISOString() : null,
      canCheckoutOnline:
        status === 'CONNECTED' || (usesPlatformFallback && process.env.PAYMENTS_MOCK !== 'true'),
      oauthConfigured,
      mockConnectAvailable: process.env.PAYMENTS_MOCK === 'true',
      usesPlatformFallback,
    };
  }

  async getStatus(clubId: string): Promise<ClubPaymentStatusResponse> {
    const row = await this.getRow(clubId);
    const mapped = this.mapStatus(row);
    mapped.clubId = clubId;
    return mapped;
  }

  async getRow(clubId: string): Promise<PaymentConfigRow | null> {
    const result = await this.db.query<PaymentConfigRow>(
      `SELECT club_id, mp_user_id, mp_access_token_encrypted, mp_refresh_token_encrypted,
              token_expires_at, connected_at, status
       FROM club_payment_config
       WHERE club_id = $1`,
      [clubId],
    );
    return result.rows[0] ?? null;
  }

  async startOAuth(
    clubId: string,
    userId: string,
    returnTo?: 'web' | 'mobile',
  ): Promise<{ authUrl: string; state: string }> {
    if (!this.isOAuthConfigured()) {
      throw new BadRequestException(
        'Mercado Pago OAuth no está configurado. Contactá a soporte de x4 match.',
      );
    }

    const state = this.signOAuthState({
      clubId,
      userId,
      returnTo: returnTo ?? 'mobile',
      exp: Date.now() + 10 * 60 * 1000,
    });

    const params = new URLSearchParams({
      client_id: process.env.MP_APP_ID!.trim(),
      response_type: 'code',
      platform_id: 'mp',
      state,
      redirect_uri: this.oauthRedirectUri(),
    });

    return {
      authUrl: `https://auth.mercadopago.com/authorization?${params.toString()}`,
      state,
    };
  }

  /**
   * Destino post-OAuth. Mobile usa deep link (scheme x4match); Safari a veces
   * no abre custom schemes vía Location redirect — el controller sirve HTML puente.
   */
  async handleOAuthCallback(
    code: string | undefined,
    state: string | undefined,
    error?: string,
  ): Promise<{
    returnTo: 'web' | 'mobile';
    url: string;
    ok: boolean;
    title: string;
    detail: string;
  }> {
    let returnToRaw: string | undefined;
    try {
      if (state) {
        returnToRaw = this.verifyOAuthState(state).returnTo;
      }
    } catch {
      returnToRaw = undefined;
    }
    const returnTo: 'web' | 'mobile' = returnToRaw === 'web' ? 'web' : 'mobile';
    const base = this.oauthReturnBase(returnTo);

    if (error) {
      return {
        returnTo,
        url: `${base}?status=error&message=${encodeURIComponent(error)}`,
        ok: false,
        title: 'No se pudo conectar',
        detail: error,
      };
    }
    if (!code || !state) {
      const detail = 'Faltan parámetros de Mercado Pago';
      return {
        returnTo,
        url: `${base}?status=error&message=${encodeURIComponent(detail)}`,
        ok: false,
        title: 'No se pudo conectar',
        detail,
      };
    }

    try {
      const { clubId, returnTo: verifiedReturnTo } = this.verifyOAuthState(state);
      const tokens = await this.exchangeAuthorizationCode(code);
      await this.saveTokens(clubId, tokens);
      const resolvedReturnTo: 'web' | 'mobile' = verifiedReturnTo === 'web' ? 'web' : 'mobile';
      const redirectBase = this.oauthReturnBase(resolvedReturnTo);
      return {
        returnTo: resolvedReturnTo,
        url: `${redirectBase}?clubId=${encodeURIComponent(clubId)}&status=connected`,
        ok: true,
        title: 'Mercado Pago conectado',
        detail:
          'Ya podés volver a la app x4 match. Si Safari no abre sola, tocá el botón de abajo o cerrá esta ventana y entrá a Pagos en la app.',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo conectar Mercado Pago';
      this.logger.warn(`OAuth MP falló: ${message}`);
      return {
        returnTo,
        url: `${base}?status=error&message=${encodeURIComponent(message)}`,
        ok: false,
        title: 'No se pudo conectar',
        detail: message,
      };
    }
  }

  /** Página intermedia para iOS Safari (custom URL schemes no abren bien con 302). */
  buildOAuthBridgeHtml(result: {
    url: string;
    ok: boolean;
    title: string;
    detail: string;
  }): string {
    const safeUrl = result.url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const jsUrl = JSON.stringify(result.url);
    const color = result.ok ? '#16a34a' : '#dc2626';
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${result.title}</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 2rem 1.25rem;
      background: #0a0a0a; color: #fafafa; text-align: center; }
    h1 { font-size: 1.25rem; color: ${color}; }
    p { color: #a3a3a3; line-height: 1.5; max-width: 22rem; margin: 0.75rem auto 1.5rem; }
    a.btn { display: inline-block; background: #f5c518; color: #0a0a0a; font-weight: 700;
      text-decoration: none; padding: 0.85rem 1.25rem; border-radius: 999px; }
  </style>
</head>
<body>
  <h1>${result.title}</h1>
  <p>${result.detail}</p>
  <p><a class="btn" id="open" href="${safeUrl}">Volver a x4 match</a></p>
  <script>
    (function () {
      var target = ${jsUrl};
      try { window.location.replace(target); } catch (e) {}
      setTimeout(function () {
        try { window.location.href = target; } catch (e2) {}
      }, 400);
    })();
  </script>
</body>
</html>`;
  }

  private async exchangeAuthorizationCode(code: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    userId: string;
    expiresIn?: number;
  }> {
    const body = {
      client_id: process.env.MP_APP_ID!.trim(),
      client_secret: process.env.MP_CLIENT_SECRET!.trim(),
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.oauthRedirectUri(),
    };

    const res = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      user_id?: number | string;
      expires_in?: number;
      message?: string;
      error?: string;
    };

    if (!res.ok || !data.access_token) {
      throw new BadRequestException(
        data.message || data.error || 'Mercado Pago rechazó la autorización',
      );
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      userId: String(data.user_id ?? ''),
      expiresIn: data.expires_in,
    };
  }

  async saveTokens(
    clubId: string,
    tokens: {
      accessToken: string;
      refreshToken?: string;
      userId: string;
      expiresIn?: number;
    },
  ): Promise<void> {
    const expiresAt =
      tokens.expiresIn != null
        ? new Date(Date.now() + tokens.expiresIn * 1000)
        : null;

    await this.db.query(
      `INSERT INTO club_payment_config (
         club_id, mp_user_id, mp_access_token_encrypted, mp_refresh_token_encrypted,
         token_expires_at, connected_at, status, updated_at
       ) VALUES ($1, $2, $3, $4, $5, NOW(), 'CONNECTED', NOW())
       ON CONFLICT (club_id) DO UPDATE SET
         mp_user_id = EXCLUDED.mp_user_id,
         mp_access_token_encrypted = EXCLUDED.mp_access_token_encrypted,
         mp_refresh_token_encrypted = EXCLUDED.mp_refresh_token_encrypted,
         token_expires_at = EXCLUDED.token_expires_at,
         connected_at = NOW(),
         status = 'CONNECTED',
         updated_at = NOW()`,
      [
        clubId,
        tokens.userId,
        encryptSecret(tokens.accessToken),
        tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
        expiresAt,
      ],
    );
  }

  async disconnect(clubId: string): Promise<ClubPaymentStatusResponse> {
    await this.db.query(
      `INSERT INTO club_payment_config (club_id, status, updated_at)
       VALUES ($1, 'DISCONNECTED', NOW())
       ON CONFLICT (club_id) DO UPDATE SET
         mp_user_id = NULL,
         mp_access_token_encrypted = NULL,
         mp_refresh_token_encrypted = NULL,
         token_expires_at = NULL,
         connected_at = NULL,
         status = 'DISCONNECTED',
         updated_at = NOW()`,
      [clubId],
    );
    return this.getStatus(clubId);
  }

  async setPaymentMode(
    clubId: string,
    mode: 'online' | 'manual',
  ): Promise<ClubPaymentStatusResponse> {
    if (mode === 'manual') {
      await this.db.query(
        `INSERT INTO club_payment_config (club_id, status, updated_at)
         VALUES ($1, 'MANUAL_ONLY', NOW())
         ON CONFLICT (club_id) DO UPDATE SET
           status = 'MANUAL_ONLY',
           updated_at = NOW()`,
        [clubId],
      );
      return this.getStatus(clubId);
    }

    const row = await this.getRow(clubId);
    if (!row?.mp_access_token_encrypted) {
      throw new BadRequestException('Conectá Mercado Pago antes de activar cobros online');
    }

    await this.db.query(
      `UPDATE club_payment_config SET status = 'CONNECTED', updated_at = NOW() WHERE club_id = $1`,
      [clubId],
    );
    return this.getStatus(clubId);
  }

  async mockConnect(clubId: string): Promise<ClubPaymentStatusResponse> {
    if (process.env.PAYMENTS_MOCK !== 'true') {
      throw new BadRequestException('Conexión simulada solo en modo PAYMENTS_MOCK');
    }

    await this.saveTokens(clubId, {
      accessToken: `mock-access-${clubId}`,
      refreshToken: `mock-refresh-${clubId}`,
      userId: `mock-mp-${clubId.slice(0, 8)}`,
      expiresIn: 60 * 60 * 24 * 180,
    });
    return this.getStatus(clubId);
  }

  async resolveAccessTokenForClub(clubId: string | null | undefined): Promise<{
    accessToken: string | null;
    collectorUserId: string | null;
    source: 'club' | 'platform' | 'none';
  }> {
    if (!clubId) {
      return {
        accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() || null,
        collectorUserId: null,
        source: process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() ? 'platform' : 'none',
      };
    }

    const row = await this.getRow(clubId);
    if (row?.status === 'CONNECTED' && row.mp_access_token_encrypted) {
      try {
        let accessToken = decryptSecret(row.mp_access_token_encrypted);

        if (
          row.token_expires_at &&
          new Date(row.token_expires_at).getTime() < Date.now() + 60_000 &&
          row.mp_refresh_token_encrypted
        ) {
          accessToken = await this.refreshAccessToken(clubId, row);
        }

        return {
          accessToken,
          collectorUserId: row.mp_user_id,
          source: 'club',
        };
      } catch (err) {
        this.logger.warn(`Token MP del club ${clubId} inválido`, err);
        await this.markExpired(clubId);
      }
    }

    const platform = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
    return {
      accessToken: platform || null,
      collectorUserId: null,
      source: platform ? 'platform' : 'none',
    };
  }

  private async markExpired(clubId: string): Promise<void> {
    await this.db.query(
      `UPDATE club_payment_config SET status = 'EXPIRED', updated_at = NOW() WHERE club_id = $1`,
      [clubId],
    );
  }

  private async refreshAccessToken(clubId: string, row: PaymentConfigRow): Promise<string> {
    if (!row.mp_refresh_token_encrypted || !this.isOAuthConfigured()) {
      await this.markExpired(clubId);
      throw new NotFoundException('Sesión de Mercado Pago expirada');
    }

    const refreshToken = decryptSecret(row.mp_refresh_token_encrypted);
    const res = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.MP_APP_ID!.trim(),
        client_secret: process.env.MP_CLIENT_SECRET!.trim(),
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      user_id?: number | string;
    };

    if (!res.ok || !data.access_token) {
      await this.markExpired(clubId);
      throw new NotFoundException('No se pudo renovar Mercado Pago');
    }

    await this.saveTokens(clubId, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      userId: String(data.user_id ?? row.mp_user_id ?? ''),
      expiresIn: data.expires_in,
    });

    return data.access_token;
  }
}
