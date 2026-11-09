import { EmailStatus } from './entities/email-log.entity';
import { EmailService } from './email.service';

describe('project emails', () => {
  it('writes a mentor assignment email log with project data', async () => {
    const emailLogRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const provider = { isConfigured: jest.fn().mockReturnValue(false), send: jest.fn() };
    const service = new EmailService(
      emailLogRepo as any, {} as any, {} as any, {} as any, {} as any,
      provider as any, {} as any,
    );

    const result = await service.sendProjectEmail({
      template: 'project_mentor_assigned', to: 'mentor@example.test',
      memberName: 'Mentor Sintético', projectName: 'Projeto Sintético', projectId: 'project-1',
    });

    expect(result.status).toBe(EmailStatus.SKIPPED);
    expect(result.template).toBe('project_mentor_assigned');
    expect(provider.send).not.toHaveBeenCalled();
    expect(emailLogRepo.create).toHaveBeenCalledWith(expect.objectContaining({ to: 'mentor@example.test' }));
  });
});
