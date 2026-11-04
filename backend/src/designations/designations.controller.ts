import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Validate,
  ValidatorConstraint,
} from 'class-validator';
import type {
  ValidationArguments,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { DesignationsService } from './designations.service';
import { designationTargetError } from './designation-target';
import {
  DESIGNATION_STATUSES,
  DESIGNATIONS,
  TARGET_TYPES,
} from './entities/member-designation.entity';
import type {
  Designation,
  DesignationStatus,
  TargetType,
} from './entities/member-designation.entity';

@ValidatorConstraint({ name: 'designationTarget', async: false })
class DesignationTargetConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args?: ValidationArguments) {
    return (
      !!args && !designationTargetError(args.object as GrantDesignationDto)
    );
  }

  defaultMessage(args?: ValidationArguments) {
    return args
      ? (designationTargetError(args.object as GrantDesignationDto) ??
          'Combinação de designation e destino inválida.')
      : 'Combinação de designation e destino inválida.';
  }
}

export class GrantDesignationDto {
  @IsUUID()
  memberId: string;

  @IsIn([...TARGET_TYPES])
  @Validate(DesignationTargetConstraint)
  targetType: TargetType;

  @IsOptional()
  @IsUUID()
  targetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  targetKey?: string;

  @IsIn([...DESIGNATIONS])
  designation: Designation;

  @IsOptional()
  @IsIn([...DESIGNATION_STATUSES])
  status?: DesignationStatus;
}

@ApiTags('Designations')
@Controller('designations')
export class DesignationsController {
  constructor(private readonly designationsService: DesignationsService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMyDesignations(@Req() req: { user: JwtPayload }) {
    return this.designationsService.listActive(req.user.sub);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  grant(
    @Req() req: { user: JwtPayload },
    @Body() body: GrantDesignationDto,
  ) {
    return this.designationsService.grant(
      { ...body, appointedById: req.user.sub },
      { actorId: req.user.sub, actorHandle: req.user.handle },
    );
  }

  @Post(':id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.designationsService.confirm(id, {
      actorId: req.user.sub,
      actorHandle: req.user.handle,
    });
  }

  @Post(':id/revoke')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.designationsService.revoke(id, {
      actorId: req.user.sub,
      actorHandle: req.user.handle,
    });
  }
}
