import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import {
  CreatePlayerListingDto,
  RemoveListingPhotoDto,
  UpdatePlayerListingDto,
} from './dto/player-listing.dto';
import { PlayerMarketplaceService } from './player-marketplace.service';

@Controller('marketplace')
export class PlayerMarketplaceController {
  constructor(private readonly marketplace: PlayerMarketplaceService) {}

  @Get('listings')
  @UseGuards(OptionalJwtAuthGuard)
  list(@CurrentUser() user?: { sub: string }) {
    return this.marketplace.listActive(user?.sub);
  }

  @Get('listings/mine')
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: { sub: string }) {
    return this.marketplace.listMine(user.sub);
  }

  @Get('listings/:id')
  @UseGuards(OptionalJwtAuthGuard)
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: { sub: string }) {
    return this.marketplace.getListing(id, user?.sub);
  }

  @Post('listings')
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: { sub: string }, @Body() dto: CreatePlayerListingDto) {
    return this.marketplace.create(user.sub, dto);
  }

  @Patch('listings/:id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdatePlayerListingDto,
  ) {
    return this.marketplace.update(user.sub, id, dto);
  }

  @Delete('listings/:id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: { sub: string }) {
    return this.marketplace.remove(user.sub, id);
  }

  @Post('listings/:id/photos')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype?.startsWith('image/')) {
          cb(new BadRequestException('Solo se permiten imágenes'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  addPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { sub: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Archivo requerido');
    }
    return this.marketplace.addPhoto(user.sub, id, file);
  }

  @Post('listings/:id/photos/remove')
  @UseGuards(JwtAuthGuard)
  removePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: RemoveListingPhotoDto,
  ) {
    return this.marketplace.removePhoto(user.sub, id, dto.url);
  }
}
