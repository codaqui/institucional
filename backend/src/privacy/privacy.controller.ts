import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import { AccountDeletionService } from './account-deletion.service';

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
}
