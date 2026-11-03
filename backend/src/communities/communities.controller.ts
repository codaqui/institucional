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
import { JwtPayload } from '../auth/jwt.strategy';
import { Designations } from '../designations/designations.decorator';
import { DesignationsGuard } from '../designations/designations.guard';
import { CommunitiesService } from './communities.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { ListCommunitiesDto } from './dto/list-communities.dto';
import { SealCommunityDto } from './dto/seal-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';

@ApiTags('Communities')
@Controller('communities')
export class CommunitiesController {
  constructor(private readonly communities: CommunitiesService) {}

  @Get('public')
  listPublic() {
    return this.communities.listPublic();
  }

  @Get('manage')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  listManage(
    @Query() query: ListCommunitiesDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.communities.listManage(query, req.user);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  create(@Body() body: CreateCommunityDto, @Req() req: { user: JwtPayload }) {
    return this.communities.create(body, req.user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, DesignationsGuard)
  @Designations({
    targetType: 'community',
    targetIdParam: 'id',
    designation: 'responsible',
  })
  @ApiBearerAuth('jwt')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCommunityDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.communities.update(id, body, req.user);
  }

  @Post(':id/seal/request')
  @UseGuards(JwtAuthGuard, DesignationsGuard)
  @Designations({
    targetType: 'community',
    targetIdParam: 'id',
    designation: 'responsible',
  })
  @ApiBearerAuth('jwt')
  requestSeal(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.communities.requestSeal(id, req.user);
  }

  @Post(':id/seal')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  grantSeal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SealCommunityDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.communities.grantSeal(id, body, req.user);
  }
}
