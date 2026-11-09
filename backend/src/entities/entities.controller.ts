import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { CreateInstitutionDto, ListEntitiesDto, UpdateInstitutionDto } from './dto/institution.dto';
import { CreatePartnershipDto } from './dto/partnership.dto';
import { EntitiesService } from './entities.service';

@ApiTags('Entities')
@Controller('entities')
export class EntitiesController {
  constructor(private readonly entities: EntitiesService) {}

  @Get('public')
  listPublic() {
    return this.entities.listPublic();
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  listManage(@Query() query: ListEntitiesDto, @Req() req: { user: JwtPayload }) {
    return this.entities.listManage(query, req.user);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  create(@Body() body: CreateInstitutionDto, @Req() req: { user: JwtPayload }) {
    return this.entities.create(body, req.user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateInstitutionDto, @Req() req: { user: JwtPayload }) {
    return this.entities.update(id, body, req.user);
  }

  @Get(':id/partnerships')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  listPartnerships(@Param('id', ParseUUIDPipe) id: string, @Req() req: { user: JwtPayload }) {
    return this.entities.listPartnerships(id, req.user);
  }

  @Post(':id/partnerships')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  createPartnership(@Param('id', ParseUUIDPipe) id: string, @Body() body: CreatePartnershipDto, @Req() req: { user: JwtPayload }) {
    return this.entities.createPartnership(id, body, req.user);
  }
}
