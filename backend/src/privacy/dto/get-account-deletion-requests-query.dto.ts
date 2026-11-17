import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { AccountDeletionRequestStatus } from '../entities/account-deletion-request.entity';

export class GetAccountDeletionRequestsQueryDto {
  @IsOptional()
  @IsIn(['pending', 'completed', 'canceled'])
  status?: AccountDeletionRequestStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
