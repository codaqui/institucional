import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { GithubAuthGuard } from './github-auth.guard';
import { GithubStrategy } from './github.strategy';
import { JwtStrategy } from './jwt.strategy';
import { ReturnToMiddleware } from './return-to.middleware';
import { MembersModule } from '../members/members.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: '7d' },
    }),
    MembersModule,
  ],
  controllers: [AuthController],
  providers: [GithubAuthGuard, GithubStrategy, JwtStrategy],
  exports: [JwtModule],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ReturnToMiddleware)
      .forRoutes('auth/github', 'auth/logout');
  }
}
