import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
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
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { CreateNewsPostDto } from './dto/news.dto';
import { NewsService } from './news.service';

const imageUpload = FileInterceptor('image', {
  storage: memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype?.startsWith('image/')) {
      cb(new BadRequestException('Solo se permiten imágenes'), false);
      return;
    }
    cb(null, true);
  },
});

function requireFile(file?: Express.Multer.File): Express.Multer.File {
  if (!file?.buffer?.length) throw new BadRequestException('La imagen del banner es obligatoria');
  return file;
}

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  listPublic(
    @Query('q') q?: string,
    @Query('source') source?: string,
    @Query('featured') featured?: string,
    @Query('clubId') clubId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.newsService.listPublic({
      q,
      source,
      featured: featured === 'true',
      clubId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('banners')
  listFeatured() {
    return this.newsService.listFeatured();
  }

  @Get('settings')
  getSettings() {
    return this.newsService.getSettings();
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentUser() user: { sub: string }) {
    return this.newsService.listMine(user.sub);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(imageUpload)
  createPlayerPost(
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateNewsPostDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.newsService.createPlayerPost(user.sub, dto, requireFile(file));
  }

  @Get('club/:clubId')
  @UseGuards(JwtAuthGuard)
  listForClub(
    @Param('clubId', new ParseUUIDPipe()) clubId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.newsService.listForClub(clubId, user.sub);
  }

  @Post('club/:clubId')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(imageUpload)
  createClubPost(
    @Param('clubId', new ParseUUIDPipe()) clubId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateNewsPostDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.newsService.createClubPost(clubId, user.sub, dto, requireFile(file));
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  getOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user?: { sub?: string },
  ) {
    return this.newsService.getForViewer(id, user?.sub);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: { sub: string }) {
    return this.newsService.deleteByOwner(id, user.sub);
  }
}
