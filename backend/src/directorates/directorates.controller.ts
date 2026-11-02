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
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { Designations } from '../designations/designations.decorator';
import { DesignationsGuard } from '../designations/designations.guard';
import { CreateDirectorateDto } from './dto/create-directorate.dto';
import { ListDirectoratesDto } from './dto/list-directorates.dto';
import { UpdateDirectorateDto } from './dto/update-directorate.dto';
import { DirectoratesService } from './directorates.service';

@ApiTags('Directorates')
@Controller('directorates')
export class DirectoratesController {
  constructor(private readonly directorates: DirectoratesService) {}

  @Get('public')
  listPublic() {
    return this.directorates.listPublic();
  }

  @Get('manage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'diretor')
  listManage(@Query() query: ListDirectoratesDto) {
    return this.directorates.listManage(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(@Body() body: CreateDirectorateDto) {
    return this.directorates.create(body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, DesignationsGuard)
  @Roles('admin', 'diretor')
  @Designations({
    targetType: 'directorate',
    targetIdParam: 'id',
    designation: 'director',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDirectorateDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.directorates.update(id, body, req.user);
  }
}
