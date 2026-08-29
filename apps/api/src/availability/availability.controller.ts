import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  SetAvailabilityDto,
  AvailabilitySlotDto,
  UpdateAvailabilitySlotDto,
} from './dto/set-availability.dto';

@Controller('availability')
@UseGuards(JwtAuthGuard)
export class AvailabilityController {
  constructor(private availabilityService: AvailabilityService) {}

  // Reemplazar toda la disponibilidad
  @Post()
  async setAvailability(
    @CurrentUser() user: any,
    @Body() dto: SetAvailabilityDto,
  ) {
    return this.availabilityService.setAvailability(
      user.sub,
      dto.availabilities,
    );
  }

  // Obtener mi disponibilidad
  @Get('me')
  async getMyAvailability(@CurrentUser() user: any) {
    return this.availabilityService.getMyAvailability(user.sub);
  }

  // Agregar un slot individual
  @Post('slot')
  async addSlot(
    @CurrentUser() user: any,
    @Body() dto: AvailabilitySlotDto,
  ) {
    return this.availabilityService.addSlot(user.sub, dto);
  }

  // Actualizar un slot individual
  @Patch('slot/:id')
  async updateSlot(
    @CurrentUser() user: any,
    @Param('id') slotId: string,
    @Body() dto: UpdateAvailabilitySlotDto,
  ) {
    return this.availabilityService.updateSlot(user.sub, slotId, dto);
  }

  // Eliminar un slot individual
  @Delete('slot/:id')
  async deleteSlot(
    @CurrentUser() user: any,
    @Param('id') slotId: string,
  ) {
    return this.availabilityService.deleteSlot(user.sub, slotId);
  }
}
