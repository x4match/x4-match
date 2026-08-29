import { IsArray, ValidateNested, IsInt, Min, Max, IsOptional, IsString, Validate, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { Type } from 'class-transformer';

@ValidatorConstraint({ name: 'isStartBeforeEnd', async: false })
class IsStartBeforeEndConstraint implements ValidatorConstraintInterface {
  validate(_value: any, args: ValidationArguments) {
    const obj = args.object as AvailabilitySlotDto;
    return obj.startHour < obj.endHour;
  }

  defaultMessage() {
    return 'La hora de inicio debe ser anterior a la hora de fin';
  }
}

export class AvailabilitySlotDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsInt()
  @Min(6)
  @Max(22)
  startHour: number;

  @IsInt()
  @Min(7)
  @Max(22)
  @Validate(IsStartBeforeEndConstraint)
  endHour: number;

  @IsOptional()
  @IsString()
  clubId?: string;
}

export class SetAvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  availabilities: AvailabilitySlotDto[];
}

export class UpdateAvailabilitySlotDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsOptional()
  @IsInt()
  @Min(6)
  @Max(22)
  startHour?: number;

  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(22)
  endHour?: number;
}
