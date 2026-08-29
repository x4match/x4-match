import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class NotifyClubSegmentDto {
  @IsIn(['new', 'frequent', 'inactive', 'top'])
  segment: 'new' | 'frequent' | 'inactive' | 'top';

  @IsString()
  @MinLength(3)
  @MaxLength(80)
  title: string;

  @IsString()
  @MinLength(3)
  @MaxLength(400)
  body: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  actionLabel?: string;
}
