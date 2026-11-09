import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

export class BatchCheckinDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  tokens: string[];
}

export class BatchCertificateInviteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  registrationIds: string[];
}
