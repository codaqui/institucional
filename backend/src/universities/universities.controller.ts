import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import { AmbassadorApplicationDto, ConfirmAmbassadorDto, CreateCityDto, CreateUniversityInstitutionDto, UpdateCityDto, UpdateUniversityInstitutionDto } from './dto/university.dto';
import { UniversitiesService } from './universities.service';

@ApiTags('Universities')
@Controller('universities')
export class UniversitiesController {
  constructor(private readonly universities: UniversitiesService) {}

  @Get('public')
  getPublic() {
    return this.universities.getPublic();
  }

  @Get('manage')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  getManage(@Req() req: { user: JwtPayload }) {
    return this.universities.getManage(req.user);
  }

  @Post('cities')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  createCity(@Body() dto: CreateCityDto, @Req() req: { user: JwtPayload }) {
    return this.universities.createCity(dto, req.user);
  }

  @Patch('cities/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  updateCity(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCityDto, @Req() req: { user: JwtPayload }) {
    return this.universities.updateCity(id, dto, req.user);
  }

  @Post('institutions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  createInstitution(@Body() dto: CreateUniversityInstitutionDto, @Req() req: { user: JwtPayload }) {
    return this.universities.createInstitution(dto, req.user);
  }

  @Patch('institutions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  updateInstitution(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUniversityInstitutionDto, @Req() req: { user: JwtPayload }) {
    return this.universities.updateInstitution(id, dto, req.user);
  }

  @Post('institutions/:id/ambassador-applications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  applyAmbassador(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AmbassadorApplicationDto, @Req() req: { user: JwtPayload }) {
    return this.universities.applyAmbassador(id, dto, req.user);
  }

  @Get('ambassador-applications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  listApplications(@Req() req: { user: JwtPayload }) {
    return this.universities.listApplications(req.user);
  }

  @Get('ambassador-applications/my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  listMyApplications(@Req() req: { user: JwtPayload }) {
    return this.universities.listMyApplications(req.user);
  }

  @Post('ambassador-applications/:id/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  rejectApplication(@Param('id', ParseUUIDPipe) id: string, @Req() req: { user: JwtPayload }) {
    return this.universities.rejectApplication(id, req.user);
  }

  @Post('ambassador-applications/:id/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  confirmApplication(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmAmbassadorDto, @Req() req: { user: JwtPayload }) {
    return this.universities.confirmApplication(id, dto, req.user);
  }
}
