import { Body, Controller, Param, ParseUUIDPipe, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { UpdatePartnershipDto } from './dto/partnership.dto';
import { EntitiesService } from './entities.service';

@ApiTags('Partnerships')
@Controller('partnerships')
export class PartnershipsController {
  constructor(private readonly entities: EntitiesService) {}

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdatePartnershipDto, @Req() req: { user: JwtPayload }) {
    return this.entities.updatePartnership(id, body, req.user);
  }
}
