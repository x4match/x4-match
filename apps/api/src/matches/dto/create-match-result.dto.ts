import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { SetScoreDto } from './set-score.dto';
import { PlayerRatingDto } from './player-rating.dto';

export class CreateMatchResultDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => SetScoreDto)
  sets: SetScoreDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => PlayerRatingDto)
  playerRatings?: PlayerRatingDto[];
}
