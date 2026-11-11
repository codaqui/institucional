import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { TurnstileGuard } from '../src/common/turnstile/turnstile.guard';
import type { JwtPayload } from '../src/auth/jwt.strategy';

type E2eApplicationOptions = {
  turnstile?: boolean;
  configureApp?: (app: INestApplication<App>) => void;
};

export async function createE2eApplication<T extends Record<string, JwtPayload>>(
  actors: T,
  options: E2eApplicationOptions = {},
) {
  let builder: TestingModuleBuilder = Test.createTestingModule({ imports: [AppModule] })
    .overrideGuard(JwtAuthGuard)
    .useValue({
      canActivate: (context: ExecutionContext) => {
        const req = context.switchToHttp().getRequest<{
          headers: Record<string, string | undefined>;
          user?: JwtPayload;
        }>();
        const actor = req.headers['x-test-actor'] as keyof T | undefined;
        req.user = actor ? actors[actor] : undefined;
        return true;
      },
    });
  if (options.turnstile) {
    builder = builder.overrideGuard(TurnstileGuard).useValue({ canActivate: () => true });
  }

  const moduleFixture = await builder.compile();
  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  options.configureApp?.(app);
  await app.init();
  return { app, dataSource: moduleFixture.get(DataSource), moduleFixture };
}

export async function bootstrapE2eActors(
  actors: Record<string, JwtPayload>,
  prefix: string,
  removeFixtures: (dataSource: DataSource) => Promise<void>,
) {
  const context = await createE2eApplication(actors);
  await removeFixtures(context.dataSource);
  await context.dataSource.getRepository('members').save(Object.entries(actors).map(([key, actor]) => ({
    id: actor.sub,
    githubId: `e2e-${prefix.toLowerCase()}-${key}`,
    githubHandle: actor.handle,
    name: `Ator ${prefix} ${key}`,
    email: `${key}@e2e.invalid`,
    avatarUrl: '',
    roles: actor.roles,
  })));
  return context;
}

export async function closeE2eApplication(
  app: INestApplication<App> | undefined,
  dataSource: DataSource | undefined,
  removeFixtures: (dataSource: DataSource) => Promise<void>,
): Promise<void> {
  if (dataSource) await removeFixtures(dataSource);
  if (app) await app.close();
}
