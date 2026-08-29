import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { MatchInviteDto } from './match-invite.dto';

export class AddMatchInvitesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => MatchInviteDto)
  invites: MatchInviteDto[];
}
