import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { PlayerRatingDto } from './player-rating.dto';

export class ConfirmMatchResultDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => PlayerRatingDto)
  playerRatings?: PlayerRatingDto[];
}
