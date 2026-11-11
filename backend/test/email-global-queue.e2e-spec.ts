import { DataSource } from 'typeorm';
import {
  EmailService,
  EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION,
} from '../src/notifications/email.service';
import { EmailTemplateService } from '../src/notifications/email-template.service';
import type { SmtpEmailProvider } from '../src/notifications/email.provider';

const testDatabase = process.env.DB_NAME ?? '';
if (!testDatabase.endsWith('_test')) {
  throw new Error('O E2E da fila global exige DB_NAME terminado em _test.');
}

const lockParams = [0x436f6461, 1];
const context = {
  attendeeName: 'Ana',
  eventTitle: 'Evento X',
  eventStartAt: new Date('2026-08-10T13:00:00Z'),
  eventTimeZone: 'America/Sao_Paulo',
};

function makeDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number.parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'codaqui',
    password: process.env.DB_PASSWORD || '',
    database: testDatabase,
  });
}

function makeService(dataSource: DataSource, provider: SmtpEmailProvider) {
  const emailLogRepo = {
    create: (value: unknown) => value,
    save: (value: unknown) => Promise.resolve(value),
    manager: { connection: dataSource },
  };
  const templateRepo = { findOneBy: jest.fn().mockResolvedValue(null) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  return new EmailService(
    emailLogRepo as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    provider,
    new EmailTemplateService(templateRepo as any, audit as any),
  );
}

async function waitFor(condition: () => Promise<boolean>): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Condição não atingida dentro do limite.');
}

describe('Fila global de SMTP — PostgreSQL real', () => {
  let firstDataSource: DataSource;
  let secondDataSource: DataSource;

  beforeAll(async () => {
    firstDataSource = makeDataSource();
    secondDataSource = makeDataSource();
    await Promise.all([
      firstDataSource.initialize(),
      secondDataSource.initialize(),
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      firstDataSource?.destroy(),
      secondDataSource?.destroy(),
    ]);
  });

  it('permite no máximo um envio entre DataSources e remove o lock ao concluir', async () => {
    let active = 0;
    let maxActive = 0;
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const send = jest.fn(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      if (send.mock.calls.length === 1) await firstGate;
      active -= 1;
    });
    const firstProvider = {
      isConfigured: jest.fn().mockReturnValue(true),
      send,
    } as unknown as SmtpEmailProvider;
    const secondProvider = {
      isConfigured: jest.fn().mockReturnValue(true),
      send,
    } as unknown as SmtpEmailProvider;
    const firstService = makeService(firstDataSource, firstProvider);
    const secondService = makeService(secondDataSource, secondProvider);

    const first = firstService.sendTemplate(
      EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION,
      'first@e2e.invalid',
      context,
    );
    await waitFor(async () => send.mock.calls.length === 1);
    (EmailService as any).smtpChain = Promise.resolve();
    const second = secondService.sendTemplate(
      EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION,
      'second@e2e.invalid',
      context,
    );

    try {
      await waitFor(async () => {
        const [row] = await firstDataSource.query(
          "SELECT COUNT(*)::int AS total FROM pg_locks WHERE locktype = 'advisory' AND classid = $1 AND objid = $2",
          lockParams,
        );
        return row.total === 2;
      });
      expect(send).toHaveBeenCalledTimes(1);
      expect(maxActive).toBe(1);
    } finally {
      releaseFirst();
    }
    await Promise.all([first, second]);

    expect(send).toHaveBeenCalledTimes(2);
    expect(maxActive).toBe(1);
    const [remaining] = await firstDataSource.query(
      "SELECT COUNT(*)::int AS total FROM pg_locks WHERE locktype = 'advisory' AND classid = $1 AND objid = $2",
      lockParams,
    );
    expect(remaining.total).toBe(0);
  });
});

jest.setTimeout(30_000);
