import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const isProd = process.env.NODE_ENV === 'production';

  // Falha rápida em produção se segredos críticos estiverem ausentes
  if (isProd) {
    const required = ['JWT_SECRET', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      logger.error(`Variáveis de ambiente obrigatórias não definidas: ${missing.join(', ')}`);
      process.exit(1);
    }
  }

  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.use(cookieParser());

  // ── CORS ──────────────────────────────────────────────────────────────────
  // Em produção, restringe a origem ao frontend oficial.
  // Em dev, aceita localhost nas portas comuns.
  const allowedOrigins = isProd
    ? [process.env.FRONTEND_URL ?? 'https://codaqui.dev']
    : [
        'http://localhost:3000',
        'http://localhost:4000',
        'http://localhost:8080',
        /http:\/\/localhost:\d+/,
      ];

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // ── Validação global ───────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,        // converte query params para os tipos corretos (string → number)
      whitelist: true,        // remove campos não declarados nos DTOs
      forbidNonWhitelisted: true,  // rejeita requests com campos extras (proteção contra mass-assignment)
    }),
  );

  // ── Swagger / OpenAPI ─────────────────────────────────────────────────────
  // Disponível apenas fora de produção, ou se explicitamente habilitado via env.
  const swaggerEnabled = !isProd || process.env.SWAGGER_ENABLED === 'true';
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Codaqui API')
      .setDescription(
        'API REST do sistema financeiro da Associação Codaqui. ' +
          'Contabilidade de dupla partida, carteiras virtuais por comunidade e integração com Stripe.\n\n' +
          '> **Atenção:** endpoints marcados com 🔒 requerem JWT Bearer token obtido via `GET /auth/github`.',
      )
      .setVersion(process.env.npm_package_version ?? require('../package.json').version ?? '0.0.1')
      .addTag('Status', 'Health check e informações da API')
      .addTag('Ledger', 'Contabilidade de dupla partida — contas e transações')
      .addTag('Stripe', 'Integração com Stripe Checkout e Webhooks')
      .addTag('Auth', 'Autenticação via GitHub OAuth')
      .addTag('Members', 'Perfis de membros da Associação Codaqui')
      .addTag('Expenses', 'Gestão de despesas organizacionais')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'JWT obtido via /auth/github/callback' },
        'jwt',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list',
        filter: true,
        showRequestDuration: true,
      },
      customSiteTitle: 'Codaqui API Docs',
    });

    logger.log('Swagger UI disponível em /docs');
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`API rodando na porta ${port} [${isProd ? 'production' : 'development'}]`);
}
bootstrap();
