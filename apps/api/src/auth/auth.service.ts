import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, createPublicKey, randomInt } from 'crypto';
import {
  normalizeCategoryStatus,
  PLACEMENT_MATCHES_REQUIRED,
  ratingToSkillScore,
  resolvePlayerRating,
  resolveVisibleLevelCategory,
} from '../common/utils';
import { FejubaService } from '../integrations/fejuba/fejuba.service';
import { AuthRepository } from './auth.repository';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import {
  AppleAuthDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  GoogleAuthDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly fejubaService: FejubaService,
  ) {}

  async lookupFejuba(dni: string) {
    const normalized = this.fejubaService.normalizeDni(dni);
    if (!this.fejubaService.isValidDni(normalized)) {
      throw new BadRequestException('El DNI debe tener 7 u 8 dígitos');
    }
    return this.fejubaService.lookupByDni(normalized);
  }

  async register(dto: RegisterDto) {
    const role = dto.role || 'PLAYER';
    let appleId: string | null = null;
    let email = dto.email.trim().toLowerCase();
    let passwordHash: string | null = null;

    if (dto.identityToken) {
      const payload = await this.verifyAppleIdentityToken(dto.identityToken);
      appleId = payload.sub ?? null;
      const appleEmail = payload.email?.trim().toLowerCase();
      if (!appleId) {
        throw new UnauthorizedException('No se pudo verificar la cuenta de Apple');
      }
      if (appleEmail) {
        email = appleEmail;
      }
      if (!email) {
        throw new UnauthorizedException(
          'Apple no envió un email. Probá de nuevo o registrate con correo.',
        );
      }
      const existingApple = await this.authRepository.findByAppleId(appleId);
      if (existingApple) {
        throw new ConflictException('Esta cuenta de Apple ya está registrada. Iniciá sesión.');
      }
    } else {
      if (!dto.password || dto.password.length < 6) {
        throw new BadRequestException('La contraseña debe tener al menos 6 caracteres');
      }
      passwordHash = await bcrypt.hash(dto.password, 10);
    }

    const existingUser = await this.authRepository.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    const dni =
      role === 'PLAYER' ? this.fejubaService.normalizeDni(dto.dni ?? '') : null;
    if (role === 'PLAYER') {
      if (!dni || !this.fejubaService.isValidDni(dni)) {
        throw new BadRequestException('El DNI es requerido (7 u 8 dígitos)');
      }
    }

    let nickname =
      role === 'PLAYER' && dto.nickname ? dto.nickname.trim() : null;
    if (role === 'PLAYER') {
      if (!nickname) {
        nickname = await this.generateUniqueNickname(email);
      } else {
        const existingNickname = await this.authRepository.findByNickname(nickname);
        if (existingNickname) {
          throw new ConflictException('Ese nombre de usuario ya está en uso');
        }
      }
    }

    const displayName =
      dto.name?.trim() ||
      (role === 'PLAYER'
        ? this.fallbackNameFromEmail(email)
        : email.split('@')[0] || 'Usuario');

    const user = await this.authRepository.createUser({
      email,
      passwordHash,
      name: displayName,
      role,
      appleId,
    });

    const isFederated = Boolean(dto.fejubaId || dto.fejubaCategory);

    await this.authRepository.createPlayerForUser(user.id, {
      declaredCategory: dto.declaredCategory ?? null,
      nickname,
      gender: dto.gender ?? null,
      dni,
      fejubaId: dto.fejubaId ?? null,
      fejubaCategory: dto.fejubaCategory ?? dto.declaredCategory ?? null,
      // Solo nivelan quienes no tienen categoría federada.
      startInPlacement: role === 'PLAYER' && !isFederated,
    });

    const fullUser = await this.authRepository.findMe(user.id);

    const token = this.generateToken(user.id, user.email);
    return {
      access_token: token,
      user: this.serializeAuthUser(fullUser ?? user),
    };
  }

  private fallbackNameFromEmail(email: string): string {
    const local = email.split('@')[0]?.replace(/[._+-]+/g, ' ').trim();
    if (!local) return 'Jugador';
    return local
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  private async generateUniqueNickname(email: string): Promise<string> {
    const base = email
      .split('@')[0]
      ?.toLowerCase()
      .replace(/[^a-z0-9._]/g, '')
      .slice(0, 12) || 'jugador';

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const suffix = attempt === 0 ? '' : String(randomInt(100, 9999));
      const candidate = `${base}${suffix}`.slice(0, 20);
      if (candidate.length < 3) continue;
      const existing = await this.authRepository.findByNickname(candidate);
      if (!existing) return candidate;
    }

    return `jug${Date.now().toString(36)}`.slice(0, 20);
  }

  async loginWithGoogle(dto: GoogleAuthDto) {
    const payload = await this.verifyGoogleIdToken(dto.idToken);
    const googleId = payload.sub;
    const email = payload.email?.trim().toLowerCase();
    const name = payload.name?.trim();
    const photo = payload.picture?.trim();

    if (!googleId || !email) {
      throw new UnauthorizedException('No se pudo verificar la cuenta de Google');
    }

    let user = await this.authRepository.findByGoogleId(googleId);
    let isNewUser = false;

    if (!user) {
      const existing = await this.authRepository.findByEmail(email);
      if (existing) {
        if (existing.google_id && existing.google_id !== googleId) {
          throw new ConflictException('Este email ya está vinculado a otra cuenta de Google');
        }
        await this.authRepository.linkGoogleAccount(existing.id, googleId);
        user = await this.authRepository.findById(existing.id);
      } else {
        const displayName = name || this.fallbackNameFromEmail(email);
        user = await this.authRepository.createUser({
          email,
          passwordHash: null,
          name: displayName,
          role: 'PLAYER',
          googleId,
        });
        const nickname = await this.generateUniqueNickname(email);
        await this.authRepository.createPlayerForUser(user.id, {
          nickname,
          startInPlacement: true,
        });
        isNewUser = true;
      }
    }

    if (!user) {
      throw new UnauthorizedException('No se pudo iniciar sesión con Google');
    }

    if (photo) {
      await this.authRepository.updatePlayerPhotoIfEmpty(user.id, photo);
    }

    const fullUser = await this.authRepository.findMe(user.id);
    const token = this.generateToken(user.id, user.email);
    return {
      access_token: token,
      user: this.serializeAuthUser(fullUser ?? user),
      isNewUser,
    };
  }

  async loginWithApple(dto: AppleAuthDto) {
    const payload = await this.verifyAppleIdentityToken(dto.identityToken);
    const appleId = payload.sub;
    const email = payload.email?.trim().toLowerCase();
    const name = dto.fullName?.trim();

    if (!appleId) {
      throw new UnauthorizedException('No se pudo verificar la cuenta de Apple');
    }

    let user = await this.authRepository.findByAppleId(appleId);

    if (!user) {
      if (!email) {
        throw new UnauthorizedException(
          'Apple no envió un email. Probá de nuevo o usá otro método de ingreso.',
        );
      }
      const existing = await this.authRepository.findByEmail(email);
      if (existing) {
        if (existing.apple_id && existing.apple_id !== appleId) {
          throw new ConflictException('Este email ya está vinculado a otra cuenta de Apple');
        }
        await this.authRepository.linkAppleAccount(existing.id, appleId);
        user = await this.authRepository.findById(existing.id);
      } else {
        return {
          needsRegistration: true,
          email,
          fullName: name || undefined,
        };
      }
    }

    if (!user) {
      throw new UnauthorizedException('No se pudo iniciar sesión con Apple');
    }

    const fullUser = await this.authRepository.findMe(user.id);
    const token = this.generateToken(user.id, user.email);
    return {
      access_token: token,
      user: this.serializeAuthUser(fullUser ?? user),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.authRepository.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.password_hash) {
      throw new UnauthorizedException(this.passwordlessLoginMessage(user));
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const fullUser = await this.authRepository.findMe(user.id);
    const token = this.generateToken(user.id, user.email);
    return {
      access_token: token,
      user: this.serializeAuthUser(fullUser ?? user),
    };
  }

  async getMe(userId: string) {
    const user = await this.authRepository.findMe(userId);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    return this.serializeAuthUser(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.authRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (!user.password_hash) {
      throw new BadRequestException(
        'Esta cuenta entra con Apple o Google. No podés cambiar la contraseña.',
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.currentPassword, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('La nueva contraseña debe ser distinta de la actual');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.authRepository.updatePassword(userId, passwordHash);
    return { ok: true };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const generic = {
      ok: true,
      message: 'Si el email está registrado, te enviamos un código de recuperación.',
    };

    const user = await this.authRepository.findByEmail(dto.email.trim());
    if (!user) {
      return generic;
    }

    const code = String(randomInt(100000, 1000000));
    const codeHash = this.hashResetCode(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.authRepository.invalidatePasswordResetTokens(user.id);
    await this.authRepository.createPasswordResetToken(user.id, codeHash, expiresAt);

    // Sin proveedor de email aún: el código se registra en logs.
    // En no-producción también se devuelve para poder probar el flujo.
    this.logger.log(`Código de recuperación para ${user.email}: ${code} (expira ${expiresAt.toISOString()})`);

    if (process.env.NODE_ENV === 'production') {
      return generic;
    }

    return { ...generic, devCode: code };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.authRepository.findByEmail(dto.email.trim());
    if (!user) {
      throw new BadRequestException('Código inválido o expirado');
    }

    const codeHash = this.hashResetCode(dto.code.trim());
    const token = await this.authRepository.findValidPasswordResetToken(user.id, codeHash);
    if (!token) {
      throw new BadRequestException('Código inválido o expirado');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.authRepository.updatePassword(user.id, passwordHash);
    await this.authRepository.markPasswordResetTokenUsed(token.id);
    await this.authRepository.invalidatePasswordResetTokens(user.id);

    return { ok: true, message: 'Contraseña actualizada correctamente' };
  }

  private hashResetCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private getGoogleClientIds(): string[] {
    return [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID,
    ].filter((value): value is string => Boolean(value?.trim()));
  }

  private passwordlessLoginMessage(user: { apple_id?: string | null; google_id?: string | null }) {
    if (user.apple_id) {
      return 'Esta cuenta usa Apple. Iniciá sesión con Apple.';
    }
    if (user.google_id) {
      return 'Esta cuenta usa Google. Iniciá sesión con Google.';
    }
    return 'Esta cuenta no tiene contraseña. Usá Apple o Google.';
  }

  private appleAudience(): string {
    return process.env.APPLE_BUNDLE_ID?.trim() || 'com.x4match.app';
  }

  private async verifyAppleIdentityToken(identityToken: string) {
    try {
      const decoded = jwt.decode(identityToken, { complete: true });
      if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
        throw new UnauthorizedException('Token de Apple inválido');
      }

      const pem = await this.getApplePublicKey(decoded.header.kid);
      const payload = jwt.verify(identityToken, pem, {
        algorithms: ['RS256'],
        issuer: 'https://appleid.apple.com',
        audience: this.appleAudience(),
      }) as jwt.JwtPayload;

      if (!payload?.sub) {
        throw new UnauthorizedException('Token de Apple inválido');
      }
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.warn(`Apple token verification failed: ${(error as Error).message}`);
      throw new UnauthorizedException('Token de Apple inválido o expirado');
    }
  }

  private async getApplePublicKey(kid: string): Promise<string> {
    const res = await fetch('https://appleid.apple.com/auth/keys');
    if (!res.ok) {
      throw new UnauthorizedException('No se pudo validar el token de Apple');
    }
    const { keys } = (await res.json()) as {
      keys?: Array<{ kid: string; kty: string; alg?: string; n: string; e: string }>;
    };
    const jwk = keys?.find((key) => key.kid === kid);
    if (!jwk) {
      throw new UnauthorizedException('Token de Apple inválido');
    }
    return createPublicKey({ key: jwk, format: 'jwk' })
      .export({ type: 'spki', format: 'pem' })
      .toString();
  }

  private async verifyGoogleIdToken(idToken: string) {
    const clientIds = this.getGoogleClientIds();
    if (clientIds.length === 0) {
      throw new BadRequestException('Google Sign-In no está configurado en el servidor');
    }

    const client = new OAuth2Client(clientIds[0]);
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientIds,
      });
      const payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedException('Token de Google inválido');
      }
      if (payload.email_verified === false) {
        throw new UnauthorizedException('El email de Google no está verificado');
      }
      return payload;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.warn(`Google token verification failed: ${(error as Error).message}`);
      throw new UnauthorizedException('Token de Google inválido o expirado');
    }
  }

  private generateToken(userId: string, email: string): string {
    const token = this.jwtService.sign({ sub: userId, email });
    this.logger.log(
      `JWT emitido user=${userId} fp=${this.fingerprint(token)} exp=${process.env.JWT_EXPIRES_IN || '7d'}`,
    );
    return token;
  }

  private fingerprint(token: string): string {
    return createHash('sha256').update(token).digest('hex').slice(0, 12);
  }

  private serializeAuthUser(user: any) {
    const extras =
      user?.extras && typeof user.extras === 'object' && !Array.isArray(user.extras)
        ? user.extras
        : typeof user?.extras === 'string'
          ? (() => {
              try {
                const parsed = JSON.parse(user.extras);
                return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
              } catch {
                return {};
              }
            })()
          : {};
    const rating = resolvePlayerRating(user ?? {});
    const declaredCategory =
      typeof extras.declaredCategory === 'string' ? extras.declaredCategory : undefined;
    const categoryStatus = user.category_status != null
      ? normalizeCategoryStatus(user.category_status)
      : undefined;
    const placementMatchesPlayed =
      user.placement_matches_played != null
        ? Number(user.placement_matches_played)
        : undefined;
    const location =
      (typeof extras.location === 'string' && extras.location.trim()
        ? extras.location.trim()
        : undefined) ||
      [user.zone, user.city].filter(Boolean).join(', ') ||
      undefined;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      photo: user.photo_url ?? undefined,
      nickname: user.nickname ?? undefined,
      gender: typeof extras.gender === 'string' ? extras.gender : undefined,
      birthDate: typeof extras.birthDate === 'string' ? extras.birthDate : undefined,
      location,
      dni: typeof extras.dni === 'string' ? extras.dni : undefined,
      fejubaId: typeof extras.fejubaId === 'string' ? extras.fejubaId : undefined,
      fejubaCategory:
        typeof extras.fejubaCategory === 'string' ? extras.fejubaCategory : undefined,
      fejubaFound: Boolean(extras.fejubaId || extras.fejubaCategory),
      rating,
      skillScore: ratingToSkillScore(rating),
      levelCategory: resolveVisibleLevelCategory({
        rating,
        categoryStatus,
        declaredCategory,
      }),
      declaredCategory,
      categoryStatus,
      placementMatchesPlayed,
      placementMatchesRequired: categoryStatus != null ? PLACEMENT_MATCHES_REQUIRED : undefined,
      mainClubId:
        typeof extras.mainClubId === 'string' ? extras.mainClubId : undefined,
    };
  }
}
