import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Min,
  ValidateNested,
  Length,
} from 'class-validator';

export class CoinDistributionItemDto {
  @IsString()
  @Length(1, 255)
  githubHandle: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount: number;
}

export class DistributeCoinsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CoinDistributionItemDto)
  distributions: CoinDistributionItemDto[];
}
