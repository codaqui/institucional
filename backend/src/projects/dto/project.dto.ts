import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

class ScheduleItemDto {
  @IsInt() @Min(1) numero: number;
  @IsString() @MinLength(1) @MaxLength(500) descricao: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) carga: number;
}

class SupportPartnerDto {
  @IsString() @MinLength(1) @MaxLength(160) nome: string;
  @IsOptional() @IsString() @MaxLength(18) cnpj?: string;
}

class BudgetItemDto {
  @IsString() @MinLength(1) @MaxLength(255) descricao: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) quantidade: number;
  @IsString() @MinLength(1) @MaxLength(30) unidadeMedida: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) valorUnitario: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) valorTotalItem: number;
}

class ProjectBudgetDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => BudgetItemDto) itens: BudgetItemDto[];
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) totalGeral: number;
}

export class CreateProjectDto {
  @IsOptional() @IsIn(['programa', 'projeto', 'oficina', 'evento', 'prestacao_servicos']) kind?: 'programa' | 'projeto' | 'oficina' | 'evento' | 'prestacao_servicos';
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsUUID() entityId: string;
  @IsOptional() @IsUUID() partnershipId?: string;
  @IsOptional() @IsString() @MaxLength(1000) summary?: string;
  @IsOptional() @IsBoolean() isPublic?: boolean;
  @IsOptional() @IsIn(['draft', 'proposed', 'active', 'finished', 'canceled']) status?: 'draft' | 'proposed' | 'active' | 'finished' | 'canceled';
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsDateString() registrationStartsAt?: string;
  @IsOptional() @IsDateString() registrationEndsAt?: string;
  @IsOptional() @IsInt() @Min(1) @Max(17) odsPrimary?: number;
  @IsOptional() @IsArray() @IsInt({ each: true }) @Min(1, { each: true }) @Max(17, { each: true }) odsSecondary?: number[];
  @IsOptional() @IsString() targetCommunity?: string;
  @IsOptional() @IsString() justification?: string;
  @IsOptional() @IsString() objective?: string;
  @IsOptional() @IsString() skillsDeveloped?: string;
  @IsOptional() @IsString() methodology?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) totalHours?: number;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ScheduleItemDto) schedule?: ScheduleItemDto[];
  @IsOptional() @IsInt() @Min(0) maxParticipants?: number;
  @IsOptional() @IsUUID() mentorMemberId?: string;
  @IsOptional() @IsArray() @IsUUID(undefined, { each: true }) coMentors?: string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SupportPartnerDto) supportPartners?: SupportPartnerDto[];
  @IsOptional() @ValidateNested() @Type(() => ProjectBudgetDto) budget?: ProjectBudgetDto;
  @IsOptional() @IsArray() @IsString({ each: true }) attachments?: string[];
  @IsOptional() @IsString() internalNotes?: string;
  @IsOptional() @IsString() reportDiscussionUrl?: string;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}

export class ProjectQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 50;
  @IsOptional() @IsIn(['draft', 'proposed', 'active', 'finished', 'canceled']) status?: 'draft' | 'proposed' | 'active' | 'finished' | 'canceled';
  @IsOptional() @IsUUID() entityId?: string;
}
