const sendMail = jest.fn().mockResolvedValue({ messageId: '1' });
const createTransport = jest.fn().mockReturnValue({ sendMail });

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport },
}));

import { SmtpEmailProvider } from './email.provider';

describe('SmtpEmailProvider', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SMTP_USER = 'smtp-user';
    process.env.SMTP_PASS = 'smtp-pass';
    process.env.EMAIL_FROM = 'Codaqui <no-reply@codaqui.dev>';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('forwards attachments to Nodemailer sendMail', async () => {
    const provider = new SmtpEmailProvider();
    await provider.send({
      to: 'mentor@example.test',
      subject: 'Sessão confirmada',
      text: 'texto',
      attachments: [
        {
          filename: 'convite-mentoria.ics',
          content: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n',
          contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
        },
      ],
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'mentor@example.test',
        attachments: [
          expect.objectContaining({
            filename: 'convite-mentoria.ics',
            content: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n',
            contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
          }),
        ],
      }),
    );
  });

  it('keeps sendMail without attachments when none are provided', async () => {
    const provider = new SmtpEmailProvider();
    await provider.send({
      to: 'mentorado@example.test',
      subject: 'Sessão solicitada',
      text: 'texto',
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'mentorado@example.test',
        attachments: undefined,
      }),
    );
  });

  it('throws SMTP_NOT_CONFIGURED without credentials and never calls sendMail', async () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    const provider = new SmtpEmailProvider();

    await expect(
      provider.send({ to: 'a@b.test', subject: 's', text: 't' }),
    ).rejects.toThrow('SMTP_NOT_CONFIGURED');
    expect(sendMail).not.toHaveBeenCalled();
  });
});
