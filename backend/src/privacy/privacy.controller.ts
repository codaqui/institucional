import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { AccountDeletionService } from './account-deletion.service';
import { PrivacyExportService } from './privacy-export.service';
import { MemberExportThrottleGuard } from './member-export-throttle.guard';
import { GetAccountDeletionRequestsQueryDto } from './dto/get-account-deletion-requests-query.dto';
import { ReviewAccountDeletionRequestDto } from './dto/review-account-deletion-request.dto';

@ApiTags('Privacy')
@Controller()
export class PrivacyController {
  constructor(
    private readonly deletionService: AccountDeletionService,
    private readonly exportService: PrivacyExportService,
    private readonly auditService: AuditService,
  ) {}

  @Get('members/me/deletion-request')
  @UseGuards(JwtAuthGuard)
  getMyDeletionRequest(@Req() req: { user: JwtPayload }) {
    return this.deletionService.latestForMember(req.user.sub);
  }

  @Post('members/me/deletion-request')
  @UseGuards(JwtAuthGuard)
  requestMyDeletion(@Req() req: { user: JwtPayload }) {
    return this.deletionService.request(req.user.sub, req.user.handle);
  }

  @Post('members/me/deletion-request/cancel')
  @UseGuards(JwtAuthGuard)
  cancelMyDeletion(@Req() req: { user: JwtPayload }) {
    return this.deletionService.cancel(req.user.sub, req.user.handle);
  }

  @Get('members/me/export')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, MemberExportThrottleGuard)
  async exportMyData(
    @Req() req: { user: JwtPayload },
    @Res() res: Response,
  ): Promise<void> {
    const exported = await this.exportService.exportMember(req.user.sub);
    const date = exported.generatedAt.slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="codaqui-dados-${req.user.handle}-${date}.json"`);
    void this.auditService.log({
      action: AuditAction.MEMBER_DATA_EXPORTED,
      actorId: req.user.sub,
      actorHandle: req.user.handle,
      targetId: req.user.sub,
      targetType: 'member',
      details: { schemaVersion: exported.schemaVersion },
    });
    res.send(JSON.stringify(exported, null, 2));
  }

  @Get('admin/members/deletion-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  listDeletionRequests(@Query() query: GetAccountDeletionRequestsQueryDto) {
    return this.deletionService.list(query);
  }

  @Post('admin/members/deletion-requests/:id/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  completeDeletionRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: JwtPayload },
    @Body() body: ReviewAccountDeletionRequestDto,
  ) {
    return this.deletionService.complete(id, req.user.sub, req.user.handle, body.reviewNote);
  }
}
