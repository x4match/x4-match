import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateReportDto } from './dto/create-report.dto';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Post()
  async createReport(
    @CurrentUser() user: any,
    @Body() dto: CreateReportDto,
  ) {
    return this.reportsService.createReport({
      reporterId: user.sub,
      ...dto,
    });
  }

  @Post('block/:userId')
  async blockUser(
    @CurrentUser() user: any,
    @Param('userId') blockedId: string,
  ) {
    return this.reportsService.blockUser(user.sub, blockedId);
  }
}

