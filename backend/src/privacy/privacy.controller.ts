import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { AccountDeletionService } from './account-deletion.service';
import { GetAccountDeletionRequestsQueryDto } from './dto/get-account-deletion-requests-query.dto';
import { ReviewAccountDeletionRequestDto } from './dto/review-account-deletion-request.dto';

@ApiTags('Privacy')
@Controller()
export class PrivacyController {
  constructor(private readonly deletionService: AccountDeletionService) {}

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
