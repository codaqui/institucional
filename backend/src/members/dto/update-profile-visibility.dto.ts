import { IsBoolean } from 'class-validator';

export class UpdateProfileVisibilityDto {
  @IsBoolean() bio?: boolean;
  @IsBoolean() linkedin?: boolean;
  @IsBoolean() roles?: boolean;
  @IsBoolean() memberSince?: boolean;
  @IsBoolean() events?: boolean;
  @IsBoolean() certificates?: boolean;
  @IsBoolean() hours?: boolean;
  @IsBoolean() donations?: boolean;
  @IsBoolean() sortcoins?: boolean;
  @IsBoolean() designations?: boolean;
}
