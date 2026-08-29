import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: { sub: string }) {
    return this.usersService.getProfile(user.sub);
  }

  @Get('match-history')
  getMatchHistory(
    @CurrentUser() user: { sub: string },
    @Query('limit') limit?: string,
  ) {
    const l = limit ? parseInt(limit, 10) : undefined;
    if (l !== undefined && (Number.isNaN(l) || l < 0)) {
      return this.usersService.getMatchHistory(user.sub, undefined);
    }
    return this.usersService.getMatchHistory(user.sub, l);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: { sub: string }, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Patch('preferences')
  updatePreferences(
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.usersService.updatePreferences(user.sub, dto);
  }

  @Post('photo')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype?.startsWith('image/')) {
          cb(new BadRequestException('Solo se permiten imágenes'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadPhoto(
    @CurrentUser() user: { sub: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Archivo requerido');
    }
    return this.usersService.uploadAvatar(user.sub, file);
  }
}
