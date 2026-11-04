import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateProfileVisibilityDto {
  @IsOptional() @IsBoolean() bio?: boolean;
  @IsOptional() @IsBoolean() linkedin?: boolean;
  @IsOptional() @IsBoolean() roles?: boolean;
  @IsOptional() @IsBoolean() memberSince?: boolean;
  @IsOptional() @IsBoolean() events?: boolean;
  @IsOptional() @IsBoolean() certificates?: boolean;
  @IsOptional() @IsBoolean() hours?: boolean;
  @IsOptional() @IsBoolean() donations?: boolean;
  @IsOptional() @IsBoolean() sortcoins?: boolean;
  @IsOptional() @IsBoolean() designations?: boolean;
}
