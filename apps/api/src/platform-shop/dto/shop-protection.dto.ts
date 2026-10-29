import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const CLAIM_REASONS = [
  'NOT_RECEIVED',
  'LATE_DELIVERY',
  'NOT_AS_DESCRIBED',
  'PAYMENT_NOT_ACKNOWLEDGED',
  'NO_RESPONSE',
  'SUSPECTED_SCAM',
  'OTHER',
] as const;

export type ShopClaimReason = (typeof CLAIM_REASONS)[number];

export class BuyerIdentityDto {
  @IsEmail()
  email: string;
}

export class BuyerClaimDto extends BuyerIdentityDto {
  @IsIn(CLAIM_REASONS)
  reason: ShopClaimReason;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description: string;
}

export class BuyerReviewDto extends BuyerIdentityDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class SponsorReportDto {
  @IsIn(CLAIM_REASONS)
  reason: ShopClaimReason;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description: string;
}

export class PartnerClaimResponseDto {
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  message: string;
}

export class AdminResolveClaimDto {
  @IsIn(['RESOLVED_BUYER', 'RESOLVED_PARTNER'])
  status: 'RESOLVED_BUYER' | 'RESOLVED_PARTNER';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolutionNote?: string;
}

export class UpdateSponsorTrustDto {
  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @IsOptional()
  @IsBoolean()
  suspended?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  suspensionReason?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  deliveryDays?: number;
}
