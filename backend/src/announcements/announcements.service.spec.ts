import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';

const admin = { sub: 'admin-id', handle: 'admin', roles: ['admin'] };
const member = { sub: 'member-id', handle: 'member', roles: ['membro'] };

function makeService() {
  const repo = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 'announcement-id', ...value })),
    findAndCount: jest.fn(async () => [[], 0]),
    findOneBy: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const audit = { log: jest.fn(async () => undefined) };
  return { service: new AnnouncementsService(repo as any, audit as any), repo, audit };
}

const validInput = {
  text: 'Estamos corrigindo algumas funções. Reporte problemas no GitHub.',
  severity: 'info' as const,
  linkUrl: 'https://github.com/codaqui/institucional/issues',
  linkLabel: 'Reportar bug',
  active: true,
};

describe('AnnouncementsService', () => {
  it.each([
    ['<b>Manutenção</b>'],
    ['[link](https://example.test)'],
  ])('rejects HTML or Markdown in text: %s', async (text) => {
    const { service } = makeService();
    await expect(service.create({ ...validInput, text }, admin)).rejects.toThrow(BadRequestException);
  });

  it.each([
    ['javascript:alert(1)'],
    ['//evil.example'],
    ['https://user:pass@example.test/path'],
  ])('rejects unsafe link: %s', async (linkUrl) => {
    const { service } = makeService();
    await expect(service.create({ ...validInput, linkUrl }, admin)).rejects.toThrow(BadRequestException);
  });

  it('requires a label whenever a link exists', async () => {
    const { service } = makeService();
    await expect(service.create({ ...validInput, linkLabel: undefined }, admin)).rejects.toThrow(
      'Informe um rótulo para o link.',
    );
  });

  it('rejects a label without a link before it can freeze the public sync', async () => {
    const { service, repo } = makeService();
    await expect(service.create({ ...validInput, linkUrl: undefined }, admin)).rejects.toThrow(
      'Remova o rótulo ou informe um link.',
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rejects an inverted display window', async () => {
    const { service } = makeService();
    await expect(service.create({
      ...validInput,
      startsAt: '2026-11-12T12:00:00.000Z',
      endsAt: '2026-11-11T12:00:00.000Z',
    }, admin)).rejects.toThrow('O fim da exibição deve ser posterior ao início.');
  });

  it('requires admin even when called outside the controller guard', async () => {
    const { service } = makeService();
    await expect(service.create(validInput, member)).rejects.toThrow(ForbiddenException);
  });

  it('creates an announcement with audit and accepts a safe internal link', async () => {
    const { service, audit } = makeService();
    const created = await service.create({ ...validInput, linkUrl: '/sobre/conduta', linkLabel: 'Conduta' }, admin);
    expect(created).toMatchObject({
      id: 'announcement-id',
      createdById: admin.sub,
      updatedById: admin.sub,
      active: true,
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'announcement.created',
      actorId: admin.sub,
      targetId: 'announcement-id',
    }));
  });

  it('paginates admin listing with the standard envelope', async () => {
    const { service, repo } = makeService();
    repo.findAndCount.mockResolvedValue([[{ id: 'a-1' }], 1]);
    await expect(service.listAdmin({ page: 2, limit: 25 }, admin)).resolves.toEqual({
      data: [{ id: 'a-1' }], total: 1, page: 2, totalPages: 1, limit: 25,
    });
    expect(repo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ skip: 25, take: 25 }));
  });

  it('projects only public fields and orders error before warning, info and success', async () => {
    const { service, repo } = makeService();
    const rows = [
      { id: 'info-id', text: 'Info', severity: 'info', createdById: 'private', updatedById: 'private' },
      { id: 'error-id', text: 'Error', severity: 'error', createdById: 'private', updatedById: 'private' },
    ];
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
    };
    repo.createQueryBuilder.mockReturnValue(qb);
    const result = await service.listPublic();

    expect(qb.orderBy).toHaveBeenCalledWith(expect.stringContaining("'error'"), 'ASC');
    expect(qb.addOrderBy).toHaveBeenCalledWith('a.createdAt', 'DESC');
    expect(result).toEqual([
      { id: 'error-id', text: 'Error', severity: 'error' },
      { id: 'info-id', text: 'Info', severity: 'info' },
    ]);
    expect(JSON.stringify(result)).not.toContain('private');
    expect(JSON.stringify(result)).not.toContain('createdById');
  });

  it('deactivates logically with before/after audit instead of deleting history', async () => {
    const { service, repo, audit } = makeService();
    repo.findOneBy.mockResolvedValue({ id: 'announcement-id', active: true, text: 'Aviso' });
    const updated = await service.deactivate('announcement-id', admin);

    expect(updated.active).toBe(false);
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'announcement.deactivated',
      details: expect.objectContaining({ before: { id: 'announcement-id', active: true, text: 'Aviso' } }),
    }));
  });
});
