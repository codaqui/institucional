import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { CreateProjectDto, ProjectQueryDto, UpdateProjectDto } from './dto/project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get('public')
  listPublic() {
    return this.projects.listPublic();
  }

  @Get('public/:slug')
  publicBySlug(@Param('slug') slug: string) {
    return this.projects.publicBySlug(slug);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  listManage(@Query() query: ProjectQueryDto, @Req() req: { user: JwtPayload }) {
    return this.projects.listManage(query, req.user);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  create(@Body() body: CreateProjectDto, @Req() req: { user: JwtPayload }) {
    return this.projects.create(body, req.user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateProjectDto, @Req() req: { user: JwtPayload }) {
    return this.projects.update(id, body, req.user);
  }
}
