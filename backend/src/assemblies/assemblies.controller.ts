import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import { AssembliesService } from './assemblies.service';
import {
  CreateAssemblyDto,
  ListAssembliesDto,
  UpdateAssemblyDto,
} from './dto/assembly.dto';

@ApiTags('Assemblies')
@Controller('assemblies')
export class AssembliesController {
  constructor(private readonly assemblies: AssembliesService) {}

  @Get('public')
  listPublic() {
    return this.assemblies.listPublic();
  }

  @Get('public/:entitySlug/:slug')
  publicByEntityAndSlug(@Param('entitySlug') entitySlug: string, @Param('slug') slug: string) {
    return this.assemblies.publicByEntityAndSlug(entitySlug, slug);
  }

  @Get('public/:slug')
  publicBySlug(@Param('slug') slug: string) {
    return this.assemblies.publicBySlug(slug);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  listManage(@Query() query: ListAssembliesDto, @Req() req: { user: JwtPayload }) {
    return this.assemblies.listManage(query, req.user);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'diretor')
  @ApiBearerAuth('jwt')
  create(@Body() body: CreateAssemblyDto, @Req() req: { user: JwtPayload }) {
    return this.assemblies.create(body, req.user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'diretor')
  @ApiBearerAuth('jwt')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAssemblyDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.assemblies.update(id, body, req.user);
  }
}
