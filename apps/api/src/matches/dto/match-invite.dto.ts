import { IsIn, IsString, IsUUID, MinLength, ValidateIf } from 'class-validator';

export class MatchInviteDto {
  @ValidateIf((o: MatchInviteDto) => !o.guestName)
  @IsUUID()
  userId?: string;

  @ValidateIf((o: MatchInviteDto) => !o.userId)
  @IsString()
  @MinLength(2)
  guestName?: string;

  @IsIn(['partner', 'opponent'])
  role: 'partner' | 'opponent';
}
