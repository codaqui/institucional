import { Module } from '@nestjs/common';
import { GitHubDBService } from './github-db.service';

@Module({
  providers: [GitHubDBService],
  exports: [GitHubDBService],
})
export class GithubDbModule {}
