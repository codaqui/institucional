import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AuditService } from './audit/audit.service';
import {
  ALLOWED_ORIGINS_PROD,
  ALLOWED_ORIGINS_DEV,
} from './common/allowed-origins.config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const isProd = process.env.NODE_ENV === 'production';

  // Falha rápida em produção se segredos críticos estiverem ausentes
  if (isProd) {
    const required = [
      'JWT_SECRET',
      'GITHUB_CLIENT_ID',
      'GITHUB_CLIENT_SECRET',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
    ];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      logger.error(
        `Variáveis de ambiente obrigatórias não definidas: ${missing.join(', ')}`,
      );
      process.exit(1);
    }
  }

  let httpsOptions = undefined;
  if (process.env.HTTPS === 'true' && process.env.SSL_CRT_FILE && process.env.SSL_KEY_FILE) {
    const fs = require('fs');
    try {
      httpsOptions = {
        key: fs.readFileSync(process.env.SSL_KEY_FILE),
        cert: fs.readFileSync(process.env.SSL_CRT_FILE),
      };
      logger.log('HTTPS configurado no backend com certificados locais');
    } catch (e) {
      logger.error('Erro ao carregar certificados HTTPS: ' + e.message);
    }
  }

  const app = await NestFactory.create(AppModule, { rawBody: true, httpsOptions });

  // ── Security Headers ───────────────────────────────────────────────────────
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  app.use(cookieParser());

  // Body parser texto puro para importação CSV de participantes (2d).
  // rawBody: true já está ativo (Stripe webhooks) e não conflita — os
  // content-types são distintos do JSON parser padrão.
  app.use(express.text({ limit: '6mb', type: ['text/csv', 'text/plain'] }));

  // ── CORS ──────────────────────────────────────────────────────────────────
  // Em produção usa a whitelist completa de origens (inclui domínios whitelabel
  // como tisocial.org.br). Em dev aceita todos os localhost comuns.
  const allowedOrigins: Array<string | RegExp> = isProd
    ? [...ALLOWED_ORIGINS_PROD]
    : [
        ...ALLOWED_ORIGINS_PROD,
        ...ALLOWED_ORIGINS_DEV,
        /^https?:\/\/(.*?\.)?localhost:\d+$/,
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
      transform: true, // converte query params para os tipos corretos (string → number)
      whitelist: true, // remove campos não declarados nos DTOs
      forbidNonWhitelisted: true, // rejeita requests com campos extras (proteção contra mass-assignment)
    }),
  );

  // ── Swagger / OpenAPI ─────────────────────────────────────────────────────
  // A UI (/docs) fica disponível apenas fora de produção, ou se habilitada via
  // env. Já o documento JSON (/docs-json) é servido SEMPRE: ele alimenta a
  // página pública /desenvolvedores/api do site (ilha consome ao vivo).
  const swaggerEnabled = !isProd || process.env.SWAGGER_ENABLED === 'true';
  {
    const config = new DocumentBuilder()
      .setTitle('Codaqui API')
      .setDescription(
        'API REST do sistema financeiro da Associação Codaqui. ' +
          'Contabilidade de dupla partida, carteiras virtuais por comunidade e integração com Stripe.\n\n' +
          '> **Atenção:** endpoints marcados com 🔒 requerem JWT Bearer token obtido via `GET /auth/github`.',
      )
      .setVersion(
        process.env.npm_package_version ??
          require('../package.json').version ??
          '0.0.1',
      )
      .addTag('Status', 'Health check e informações da API')
      .addTag('Ledger', 'Contabilidade de dupla partida — contas e transações')
      .addTag('Stripe', 'Integração com Stripe Checkout e Webhooks')
      .addTag('Auth', 'Autenticação via GitHub OAuth')
      .addTag('Members', 'Perfis de membros da Associação Codaqui')
      .addTag('Expenses', 'Gestão de despesas organizacionais')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT obtido via /auth/github/callback',
        },
        'jwt',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    // Rota servida independente do swaggerEnabled (alimenta /desenvolvedores/api do site).
    const expressApp = app.getHttpAdapter().getInstance() as express.Application;
    expressApp.get('/docs-json', (_req: express.Request, res: express.Response) =>
      res.json(document),
    );
    if (swaggerEnabled) {
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
    logger.log('OpenAPI JSON disponível em /docs-json');
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(
    `API rodando na porta ${port} [${isProd ? 'production' : 'development'}]`,
  );

  // Cleanup de audit logs expirados ao iniciar (fire-and-forget)
  try {
    const auditService = app.get(AuditService);
    await auditService.cleanup();
  } catch {
    logger.warn(
      'Audit cleanup no startup falhou (tabela pode não existir ainda)',
    );
  }
}
void bootstrap();
