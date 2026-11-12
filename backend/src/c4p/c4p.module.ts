import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { C4pCall } from './entities/c4p-call.entity';
import { C4pTalk } from './entities/c4p-talk.entity';
import { C4pVote } from './entities/c4p-vote.entity';

@Module({
  imports: [TypeOrmModule.forFeature([C4pCall, C4pTalk, C4pVote])],
})
export class C4pModule {}
