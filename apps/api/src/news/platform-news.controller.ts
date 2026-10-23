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
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../platform-admin/platform-admin.guard';
import {
  ApproveNewsPostDto,
  RejectNewsPostDto,
  SetNewsFeaturedDto,
  UpdateNewsExpiryDto,
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

  @Patch(':id/expiry')
  updateExpiry(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateNewsExpiryDto) {
    return this.newsService.updateExpiry(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.newsService.adminDelete(id);
  }
}
