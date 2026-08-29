import { IsIn } from 'class-validator';

export class UpdateMatchStatusDto {
  @IsIn(['OPEN', 'FULL', 'CONFIRMED', 'IN_PROGRESS', 'FINISHED', 'CANCELLED'])
  status:
    | 'OPEN'
    | 'FULL'
    | 'CONFIRMED'
    | 'IN_PROGRESS'
    | 'FINISHED'
    | 'CANCELLED';
}
