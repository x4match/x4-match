import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { newsImageUpload, requireNewsImage } from './news-upload';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../platform-admin/platform-admin.guard';
import {
  ApproveNewsPostDto,
  CreatePlatformNewsDto,
  RejectNewsPostDto,
  SetNewsFeaturedDto,
  UpdateNewsExpiryDto,
  UpdateNewsPostDto,
  UpdateNewsSettingsDto,
} from './dto/news.dto';
import { NewsService } from './news.service';

@Controller('platform/news')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformNewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('featured') featured?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.newsService.adminList({
      q,
      status,
      source,
      featured: featured === 'true',
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post()
  @UseInterceptors(newsImageUpload)
  create(
    @CurrentUser() user: { sub: string },
    @Body() dto: CreatePlatformNewsDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.newsService.createPlatformPost(user.sub, dto, requireNewsImage(file), {
      durationDays: dto.durationDays,
      featured: dto.featured,
    });
  }

  @Get('settings')
  getSettings() {
    return this.newsService.getSettings();
  }

  @Patch('settings')
  updateSettings(@CurrentUser() user: { sub: string }, @Body() dto: UpdateNewsSettingsDto) {
    return this.newsService.updateSettings(dto.defaultDurationDays, user.sub);
  }

  @Post(':id/approve')
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: ApproveNewsPostDto,
  ) {
    return this.newsService.approve(id, user.sub, {
      durationDays: dto.durationDays,
      featured: dto.featured,
    });
  }

  @Patch(':id/featured')
  setFeatured(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: SetNewsFeaturedDto) {
    return this.newsService.setFeatured(id, dto.featured);
  }

  @Post(':id/reject')
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: RejectNewsPostDto,
  ) {
    return this.newsService.reject(id, user.sub, dto.notes);
  }

  @Patch(':id')
  @UseInterceptors(newsImageUpload)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateNewsPostDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.newsService.adminUpdate(id, dto, file?.buffer?.length ? file : undefined);
  }

  @Patch(':id/expiry')
  updateExpiry(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateNewsExpiryDto) {
    return this.newsService.updateExpiry(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.newsService.adminDelete(id);
  }
}
