import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomInt } from 'crypto';
import {
  normalizeCategoryStatus,
  PLACEMENT_MATCHES_REQUIRED,
  ratingToSkillScore,
  resolvePlayerRating,
  resolveVisibleLevelCategory,
} from '../common/utils';
import { FejubaService } from '../integrations/fejuba/fejuba.service';
import { AuthRepository } from './auth.repository';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
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
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const existingUser = await this.authRepository.findByEmail(dto.email);
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
        nickname = await this.generateUniqueNickname(dto.email);
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
        ? this.fallbackNameFromEmail(dto.email)
        : dto.email.split('@')[0] || 'Usuario');

    const user = await this.authRepository.createUser({
      email: dto.email,
      passwordHash: hashedPassword,
      name: displayName,
      role,
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

  async login(dto: LoginDto) {
    const user = await this.authRepository.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
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
