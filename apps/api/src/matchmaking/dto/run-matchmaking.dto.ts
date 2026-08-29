import { ArrayMaxSize, IsArray, IsIn, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MatchInviteDto } from '../../matches/dto/match-invite.dto';

export class RunMatchmakingDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => MatchInviteDto)
  invites?: MatchInviteDto[];

  @IsOptional()
  @IsIn(['friendly', 'competitive'])
  mode?: 'friendly' | 'competitive';

  @IsOptional()
  @IsIn(['male', 'female', 'mixed', 'open'])
  gender?: 'male' | 'female' | 'mixed' | 'open';
}
