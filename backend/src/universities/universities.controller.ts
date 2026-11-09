import { Body, Controller, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import { CreateCityDto, CreateUniversityInstitutionDto, UpdateCityDto, UpdateUniversityInstitutionDto } from './dto/university.dto';
import { UniversitiesService } from './universities.service';

@ApiTags('Universities')
@Controller('universities')
export class UniversitiesController {
  constructor(private readonly universities: UniversitiesService) {}

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
}
