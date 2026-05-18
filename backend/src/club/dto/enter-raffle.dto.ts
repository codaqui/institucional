import { IsEnum, IsOptional } from 'class-validator';
import { RaffleOwnerType } from '../entities/raffle-entry.entity';

export class EnterRaffleDto {
  @IsOptional()
  @IsEnum(RaffleOwnerType)
  ownerType?: RaffleOwnerType;
}
