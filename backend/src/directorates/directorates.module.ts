import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DesignationsModule } from '../designations/designations.module';
import { DesignationsGuard } from '../designations/designations.guard';
import { DirectoratesController } from './directorates.controller';
import { DirectoratesService } from './directorates.service';
import { Directorate } from './entities/directorate.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Directorate]), DesignationsModule],
  controllers: [DirectoratesController],
  providers: [DirectoratesService, DesignationsGuard],
})
export class DirectoratesModule {}
