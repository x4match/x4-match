import { IsIn } from 'class-validator';

export class UpdateClubPaymentModeDto {
  @IsIn(['online', 'manual'])
  mode!: 'online' | 'manual';
}
