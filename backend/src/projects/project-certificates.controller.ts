import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { ProjectCertificatesService } from './project-certificates.service';

class IssueProjectCertificateDto {
  kind: 'participant' | 'mentor_report';
}

@ApiTags('Project certificates')
@Controller('project-certificates')
export class ProjectCertificatesController {
  constructor(private readonly certificates: ProjectCertificatesService) {}

  @Post('projects/:projectId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  issue(@Param('projectId') projectId: string, @Body() body: IssueProjectCertificateDto, @Req() req: { user: JwtPayload }) {
    return this.certificates.issue(projectId, body.kind, req.user);
  }

  @Get('verify/:code')
  verify(@Param('code') code: string) {
    return this.certificates.verify(code);
  }

  @Get(':code')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  owned(@Param('code') code: string, @Req() req: { user: JwtPayload }) {
    return this.certificates.owned(code, req.user);
  }
}
