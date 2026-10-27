import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../platform-admin/platform-admin.guard';
import { UpdateAppVersionDto } from './dto/app-version.dto';
import { AppVersionService } from './app-version.service';

/** Público: la app lo consulta al abrir para sugerir o exigir actualizar. */
@Controller('app-version')
export class AppVersionController {
  constructor(private readonly appVersionService: AppVersionService) {}

  @Get()
  get() {
    return this.appVersionService.getConfig();
  }
}

@Controller('platform/app-version')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformAppVersionController {
  constructor(private readonly appVersionService: AppVersionService) {}

  @Get()
  get() {
    return this.appVersionService.getConfig();
  }

  @Patch()
  update(@CurrentUser() user: { sub: string }, @Body() dto: UpdateAppVersionDto) {
    return this.appVersionService.updateConfig(dto, user.sub);
  }
}
