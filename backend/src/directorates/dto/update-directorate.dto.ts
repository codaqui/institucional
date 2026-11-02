import { PartialType } from '@nestjs/swagger';
import { CreateDirectorateDto } from './create-directorate.dto';

export class UpdateDirectorateDto extends PartialType(CreateDirectorateDto) {}
