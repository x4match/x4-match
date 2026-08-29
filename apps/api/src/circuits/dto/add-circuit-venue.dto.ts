import { IsNotEmpty, IsUUID } from 'class-validator';

export class AddCircuitVenueDto {
  @IsUUID()
  @IsNotEmpty()
  clubId: string;
}
