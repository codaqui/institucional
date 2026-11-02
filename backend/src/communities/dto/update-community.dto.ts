import { PartialType } from '@nestjs/swagger';
import { CreateCommunityDto } from './create-community.dto';

export class UpdateCommunityDto extends PartialType(CreateCommunityDto) {}
