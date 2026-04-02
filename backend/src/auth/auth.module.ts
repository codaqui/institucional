import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { GithubStrategy } from './github.strategy';
import { JwtStrategy } from './jwt.strategy';
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
  providers: [GithubStrategy, JwtStrategy],
  exports: [JwtModule],
})
export class AuthModule {}
