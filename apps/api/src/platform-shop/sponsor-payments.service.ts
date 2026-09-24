import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { decryptSecret, encryptSecret } from '../common/utils/token-crypto';
import { DatabaseService } from '../database/database.service';
import { UpdateWhatsappPaymentDto } from './dto/platform-shop.dto';

type PaymentConfigRow = {
  sponsor_id: string;
  mp_enabled: boolean;
  mp_user_id: string | null;
  mp_access_token_encrypted: string | null;
  mp_refresh_token_encrypted: string | null;
  token_expires_at: Date | string | null;
  connected_at: Date | string | null;
  mp_status: 'DISCONNECTED' | 'CONNECTED' | 'EXPIRED';
  whatsapp_enabled: boolean;
  whatsapp_phone: string | null;
};

@Injectable()
export class SponsorPaymentsService {
  private readonly logger = new Logger(SponsorPaymentsService.name);

  constructor(private readonly db: DatabaseService) {}

  isOAuthConfigured(): boolean {
    return !!(process.env.MP_APP_ID?.trim() && process.env.MP_CLIENT_SECRET?.trim());
  }

  private publicApiBase(): string {
    return (process.env.API_PUBLIC_URL || process.env.APP_URL || 'http://localhost:5000').replace(
      /\/$/,
      '',
    );
  }

  private webSponsorsBase(): string {
    return (
      process.env.WEB_SPONSORS_PUBLIC_URL ||
      process.env.NEXT_PUBLIC_SPONSORS_URL ||
      'http://localhost:3003'
    ).replace(/\/$/, '');
  }

  private oauthRedirectUri(): string {
    if (process.env.MP_SPONSOR_REDIRECT_URI?.trim()) {
      return process.env.MP_SPONSOR_REDIRECT_URI.trim();
    }
    return `${this.publicApiBase()}/sponsors/oauth/mercadopago/callback`;
  }

  private signOAuthState(payload: Record<string, unknown>): string {
    const secret = process.env.JWT_SECRET?.trim() || process.env.PAYMENT_TOKEN_ENCRYPTION_KEY?.trim();
    if (!secret) throw new BadRequestException('OAuth no configurado');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', secret).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  private verifyOAuthState(state: string): { sponsorId: string; userId: string } {
    const [body, sig] = state.split('.');
    if (!body || !sig) throw new BadRequestException('Estado OAuth inválido');
    const secret = process.env.JWT_SECRET?.trim() || process.env.PAYMENT_TOKEN_ENCRYPTION_KEY?.trim();
    if (!secret) throw new BadRequestException('OAuth no configurado');
    const expected = createHmac('sha256', secret).update(body).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      throw new BadRequestException('Estado OAuth inválido');
    }
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      sponsorId?: string;
      userId?: string;
      exp?: number;
    };
    if (!parsed.sponsorId || !parsed.userId || !parsed.exp || parsed.exp < Date.now()) {
      throw new BadRequestException('Estado OAuth expirado');
    }
    return { sponsorId: parsed.sponsorId, userId: parsed.userId };
  }

  async ensureConfigRow(sponsorId: string) {
    await this.db.query(
      `INSERT INTO platform_sponsor_payment_config (sponsor_id)
       VALUES ($1) ON CONFLICT DO NOTHING`,
      [sponsorId],
    );
  }

  async getRow(sponsorId: string): Promise<PaymentConfigRow | null> {
    await this.ensureConfigRow(sponsorId);
    const result = await this.db.query<PaymentConfigRow>(
      `SELECT * FROM platform_sponsor_payment_config WHERE sponsor_id = $1`,
      [sponsorId],
    );
    return result.rows[0] ?? null;
  }

  async getStatus(sponsorId: string) {
    const row = await this.getRow(sponsorId);
    return {
      sponsorId,
      mpEnabled: !!(row?.mp_enabled && row.mp_status === 'CONNECTED'),
      mpStatus: row?.mp_status ?? 'DISCONNECTED',
      mpUserId: row?.mp_user_id ?? null,
      connectedAt: row?.connected_at ? new Date(row.connected_at).toISOString() : null,
      whatsappEnabled: !!row?.whatsapp_enabled && !!row?.whatsapp_phone,
      whatsappPhone: row?.whatsapp_phone ?? null,
      oauthConfigured: this.isOAuthConfigured(),
    };
  }

  async getPublicPaymentOptions(sponsorId: string) {
    const status = await this.getStatus(sponsorId);
    return {
      mpEnabled: status.mpEnabled,
      whatsappEnabled: status.whatsappEnabled,
      whatsappPhone: status.whatsappPhone,
    };
  }

  async startOAuth(sponsorId: string, userId: string) {
    if (!sponsorId || sponsorId === 'null' || sponsorId === 'undefined') {
      throw new BadRequestException('sponsorId inválido');
    }
    if (!this.isOAuthConfigured()) {
      throw new BadRequestException('Mercado Pago OAuth no está configurado');
    }
    const redirectUri = this.oauthRedirectUri();
    if (/localhost|127\.0\.0\.1/i.test(redirectUri) && process.env.NODE_ENV === 'production') {
      this.logger.error(
        `MP OAuth redirect_uri apunta a local (${redirectUri}). Configurá API_PUBLIC_URL o MP_SPONSOR_REDIRECT_URI.`,
      );
      throw new BadRequestException(
        'Mercado Pago OAuth mal configurado en el servidor (redirect_uri local). Pedile a ops que setee API_PUBLIC_URL.',
      );
    }
    const state = this.signOAuthState({
      sponsorId,
      userId,
      exp: Date.now() + 10 * 60 * 1000,
    });
    const params = new URLSearchParams({
      client_id: process.env.MP_APP_ID!.trim(),
      response_type: 'code',
      platform_id: 'mp',
      state,
      redirect_uri: redirectUri,
    });
    return {
      authUrl: `https://auth.mercadopago.com/authorization?${params.toString()}`,
      state,
    };
  }

  async handleOAuthCallback(code?: string, state?: string, error?: string) {
    const base = `${this.webSponsorsBase()}/dashboard/pagos`;
    if (error || !code || !state) {
      return {
        url: `${base}?status=error&message=${encodeURIComponent(error || 'Parámetros inválidos')}`,
        ok: false,
      };
    }
    try {
      const { sponsorId } = this.verifyOAuthState(state);
      const tokens = await this.exchangeAuthorizationCode(code);
      await this.saveTokens(sponsorId, tokens);
      return {
        url: `${base}?status=connected`,
        ok: true,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error OAuth';
      this.logger.warn(`Sponsor MP OAuth failed: ${message}`);
      return {
        url: `${base}?status=error&message=${encodeURIComponent(message)}`,
        ok: false,
      };
    }
  }

  private async exchangeAuthorizationCode(code: string) {
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
    };
    if (!res.ok || !data.access_token) {
      throw new BadRequestException(data.message || 'No se pudo obtener el token de MP');
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      userId: String(data.user_id ?? ''),
      expiresIn: data.expires_in,
    };
  }

  private async saveTokens(
    sponsorId: string,
    tokens: { accessToken: string; refreshToken?: string; userId: string; expiresIn?: number },
  ) {
    await this.ensureConfigRow(sponsorId);
    const expiresAt =
      tokens.expiresIn != null
        ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
        : null;
    await this.db.query(
      `UPDATE platform_sponsor_payment_config
       SET mp_enabled = TRUE,
           mp_user_id = $2,
           mp_access_token_encrypted = $3,
           mp_refresh_token_encrypted = $4,
           token_expires_at = $5,
           connected_at = NOW(),
           mp_status = 'CONNECTED'::sponsor_payment_status,
           updated_at = NOW()
       WHERE sponsor_id = $1`,
      [
        sponsorId,
        tokens.userId || null,
        encryptSecret(tokens.accessToken),
        tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
        expiresAt,
      ],
    );
  }

  async disconnectMp(sponsorId: string) {
    await this.db.query(
      `UPDATE platform_sponsor_payment_config
       SET mp_enabled = FALSE,
           mp_access_token_encrypted = NULL,
           mp_refresh_token_encrypted = NULL,
           mp_user_id = NULL,
           token_expires_at = NULL,
           connected_at = NULL,
           mp_status = 'DISCONNECTED'::sponsor_payment_status,
           updated_at = NOW()
       WHERE sponsor_id = $1`,
      [sponsorId],
    );
    return this.getStatus(sponsorId);
  }

  async updateWhatsapp(sponsorId: string, dto: UpdateWhatsappPaymentDto) {
    await this.ensureConfigRow(sponsorId);
    const phone = dto.phone?.replace(/[^\d]/g, '') || null;
    await this.db.query(
      `UPDATE platform_sponsor_payment_config
       SET whatsapp_enabled = COALESCE($2, whatsapp_enabled),
           whatsapp_phone = COALESCE($3, whatsapp_phone),
           updated_at = NOW()
       WHERE sponsor_id = $1`,
      [sponsorId, dto.enabled ?? null, phone],
    );
    return this.getStatus(sponsorId);
  }

  async getAccessToken(sponsorId: string): Promise<string> {
    const row = await this.getRow(sponsorId);
    if (!row?.mp_access_token_encrypted || row.mp_status !== 'CONNECTED') {
      throw new BadRequestException('Mercado Pago no conectado');
    }
    return decryptSecret(row.mp_access_token_encrypted);
  }

  async createMercadoPagoCheckout(
    sponsor: { id: string; slug: string; name: string },
    order: { id: string; total: number | string; items?: any[] },
  ) {
    const accessToken = await this.getAccessToken(sponsor.id);
    const { MercadoPagoConfig, Preference } = require('mercadopago');
    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);
    const backBase = this.webSponsorsBase();
    const created = await preference.create({
      body: {
        external_reference: order.id,
        items: (order.items || []).map((item: any) => ({
          id: item.product_id,
          title: item.product_name || 'Producto',
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          currency_id: 'ARS',
        })),
        back_urls: {
          success: `${backBase}/${sponsor.slug}/pedido/${order.id}`,
          pending: `${backBase}/${sponsor.slug}/pedido/${order.id}`,
          failure: `${backBase}/${sponsor.slug}/checkout`,
        },
        auto_return: 'approved',
        notification_url: `${this.publicApiBase()}/sponsors/webhooks/mercadopago`,
      },
    });
    const initPoint = created.init_point || created.sandbox_init_point;
    await this.db.query(
      `UPDATE platform_orders
       SET payment_checkout_url = $2,
           payment_external_reference = $3,
           payment_provider = 'MERCADOPAGO',
           updated_at = NOW()
       WHERE id = $1`,
      [order.id, initPoint, created.id],
    );
    return { checkoutUrl: initPoint, preferenceId: created.id };
  }

  buildWhatsappOrderUrl(
    sponsor: { name: string; slug: string },
    order: {
      id: string;
      total: number | string;
      guest_name?: string;
      items?: Array<{ product_name?: string; quantity: number }>;
    },
    phone: string,
  ) {
    const lines = (order.items || [])
      .map((i) => `- ${i.product_name || 'Producto'} x${i.quantity}`)
      .join('\n');
    const text = encodeURIComponent(
      `Hola ${sponsor.name}! Quiero pagar el pedido ${order.id.slice(0, 8)}.\n` +
        `Cliente: ${order.guest_name || ''}\n` +
        `Total: $${Number(order.total).toLocaleString('es-AR')}\n` +
        `${lines}\n` +
        `Tienda: ${sponsor.slug}`,
    );
    const digits = phone.replace(/[^\d]/g, '');
    return `https://wa.me/${digits}?text=${text}`;
  }

  async handleMercadoPagoWebhook(body: any) {
    const paymentId = body?.data?.id || body?.id;
    if (!paymentId) return { ok: true };
    // Resolve order via external_reference when possible
    try {
      const topic = body?.type || body?.topic;
      if (topic && topic !== 'payment') return { ok: true };
      // Without per-request token we look up recent pending orders by preference — simplified:
      // MP sends data.id; fetch payment with platform token is not available per-sponsor easily here.
      // Store external_reference on create; clients poll order status after return.
      this.logger.log(`Sponsor MP webhook received payment=${paymentId}`);
      return { ok: true, paymentId };
    } catch (err) {
      this.logger.warn(`Webhook error: ${err}`);
      return { ok: false };
    }
  }

  async markPaidByExternalReference(orderId: string) {
    const result = await this.db.query(
      `UPDATE platform_orders
       SET status = 'PAID', payment_status = 'APPROVED', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [orderId],
    );
    if (!result.rows[0]) throw new NotFoundException('Pedido no encontrado');
    return result.rows[0];
  }
}
