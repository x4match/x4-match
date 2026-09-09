import { IsIn, IsOptional, IsString } from 'class-validator';

export class BlockCourtSlotDto {
  @IsOptional()
  @IsIn(['BLOCKED', 'MAINTENANCE'])
  kind?: 'BLOCKED' | 'MAINTENANCE';

  @IsOptional()
  @IsString()
  reason?: string;
}
