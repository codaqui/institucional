import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GitHubDBService } from './github-db.service';

const ENV_KEYS = [
  'GITHUB_REPO_OWNER',
  'GITHUB_REPO_NAME',
  'GITHUB_BASE_BRANCH',
];
const TOKEN = 'gho_user-token';

const ghResponse = (status: number, data: unknown = {}) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => (typeof data === 'string' ? data : JSON.stringify(data)),
  }) as unknown as Response;

describe('GitHubDBService (user-token)', () => {
  let service: GitHubDBService;
  let fetchMock: jest.Mock;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
    process.env.GITHUB_REPO_OWNER = 'codaqui';
    process.env.GITHUB_REPO_NAME = 'institucional';

    service = new GitHubDBService();
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  // ── readFile (público, sem token) ────────────────────────────────────────

  describe('readFile', () => {
    it('lê de raw.githubusercontent.com sem header de auth', async () => {
      fetchMock.mockResolvedValueOnce(ghResponse(200, '{"version":1}'));

      const result = await service.readFile('static/events/organizers.json');

      expect(result).toBe('{"version":1}');
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(
        'https://raw.githubusercontent.com/codaqui/institucional/main/static/events/organizers.json',
      );
      expect(init?.headers?.Authorization).toBeUndefined();
    });

    it('404 → null', async () => {
      fetchMock.mockResolvedValueOnce(ghResponse(404));
      await expect(service.readFile('nope.json')).resolves.toBeNull();
    });

    it('erros propagam como 503', async () => {
      fetchMock.mockResolvedValueOnce(ghResponse(500, 'boom'));
      await expect(service.readFile('x.json')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  // ── createPRWithFile — colaborador direto ────────────────────────────────

  describe('createPRWithFile', () => {
    const opts = {
      branch: 'event-override/meetup-devparana-123-1700000000000',
      path: 'static/events/meetup/devparana/123.override.json',
      content: '{"eventId":"123"}\n',
      commitMessage: 'event: override 123 by @octo — fix',
      prTitle: 'event: override 123 by @octo — fix',
      actorHandle: 'octo',
      userToken: TOKEN,
      labels: ['event-override'],
    };

    it('colaborador (write): branch e commit direto no repo canônico', async () => {
      fetchMock
        .mockResolvedValueOnce(ghResponse(200, { permission: 'write' }))
        .mockResolvedValueOnce(ghResponse(200, { object: { sha: 'base-sha' } }))
        .mockResolvedValueOnce(ghResponse(201, {}))
        .mockResolvedValueOnce(ghResponse(404)) // arquivo não existe na branch
        .mockResolvedValueOnce(ghResponse(201, { content: { sha: 'f' } }))
        .mockResolvedValueOnce(
          ghResponse(201, { number: 42, html_url: 'https://pr/42' }),
        )
        .mockResolvedValueOnce(ghResponse(200, []));

      const result = await service.createPRWithFile(opts);

      expect(result).toEqual({ prNumber: 42, prUrl: 'https://pr/42' });

      const calls = fetchMock.mock.calls;
      // 1. probe de permissão com o token do membro
      expect(calls[0][0]).toContain('/collaborators/octo/permission');
      expect(calls[0][1].headers.Authorization).toBe(`Bearer ${TOKEN}`);
      // 2-4. branch + contents no canônico
      expect(calls[1][0]).toContain(
        '/repos/codaqui/institucional/git/ref/heads/main',
      );
      expect(calls[4][1].method).toBe('PUT');
      expect(calls[4][0]).toContain('/repos/codaqui/institucional/contents/');
      // 5. PR com head SEM prefixo (mesmo repo)
      const prBody = JSON.parse(calls[5][1].body as string);
      expect(prBody).toMatchObject({
        head: opts.branch,
        base: 'main',
        title: opts.prTitle,
      });
      // 6. label
      expect(calls[6][0]).toContain('/issues/42/labels');
    });

    it.each(['admin', 'maintain'])(
      'permissão %s também escreve direto',
      async (permission) => {
        fetchMock
          .mockResolvedValueOnce(ghResponse(200, { permission }))
          .mockResolvedValueOnce(
            ghResponse(200, { object: { sha: 'base-sha' } }),
          )
          .mockResolvedValueOnce(ghResponse(201, {}))
          .mockResolvedValueOnce(ghResponse(200, { sha: 'existing' }))
          .mockResolvedValueOnce(ghResponse(200, { content: { sha: 'n' } }))
          .mockResolvedValueOnce(ghResponse(201, { number: 7, html_url: 'u7' }))
          .mockResolvedValueOnce(ghResponse(200, []));

        await service.createPRWithFile(opts);

        // update: PUT carrega o sha do arquivo existente
        const putBody = JSON.parse(fetchMock.mock.calls[4][1].body as string);
        expect(putBody.sha).toBe('existing');
        // nenhum fork foi consultado
        expect(
          fetchMock.mock.calls.some((c) => (c[0] as string).includes('/forks')),
        ).toBe(false);
      },
    );

    it('não-colaborador: fork flow — cria fork, aguarda poll, PR com head actor:branch', async () => {
      jest.useFakeTimers();
      fetchMock
        .mockResolvedValueOnce(ghResponse(404)) // não é colaborador
        .mockResolvedValueOnce(ghResponse(404)) // fork não existe
        .mockResolvedValueOnce(ghResponse(202, {})) // POST /forks
        .mockResolvedValueOnce(
          ghResponse(200, { full_name: 'octo/institucional' }),
        ) // poll OK
        .mockResolvedValueOnce(ghResponse(200, { object: { sha: 'fork-sha' } }))
        .mockResolvedValueOnce(ghResponse(201, {}))
        .mockResolvedValueOnce(ghResponse(404))
        .mockResolvedValueOnce(ghResponse(201, { content: { sha: 'f' } }))
        .mockResolvedValueOnce(
          ghResponse(201, { number: 55, html_url: 'https://pr/55' }),
        )
        .mockResolvedValueOnce(ghResponse(200, []));

      const promise = service.createPRWithFile(opts);
      // O poll espera 2s antes de checar o fork
      await jest.advanceTimersByTimeAsync(2_000);
      const result = await promise;

      expect(result).toEqual({ prNumber: 55, prUrl: 'https://pr/55' });

      const calls = fetchMock.mock.calls;
      expect(calls[2][0]).toContain('/repos/codaqui/institucional/forks');
      expect(calls[2][1].method).toBe('POST');
      // branch/commit no FORK
      expect(calls[4][0]).toContain('/repos/octo/institucional/git/ref/');
      expect(calls[7][0]).toContain('/repos/octo/institucional/contents/');
      // PR no canônico com head "octo:branch"
      const prBody = JSON.parse(calls[8][1].body as string);
      expect(prBody.head).toBe(`octo:${opts.branch}`);
    });

    it('permissão read: cai no fork flow (fork já existente → sem poll)', async () => {
      fetchMock
        .mockResolvedValueOnce(ghResponse(200, { permission: 'read' }))
        .mockResolvedValueOnce(
          ghResponse(200, { full_name: 'octo/institucional' }),
        )
        .mockResolvedValueOnce(ghResponse(200, { object: { sha: 'fork-sha' } }))
        .mockResolvedValueOnce(ghResponse(201, {}))
        .mockResolvedValueOnce(ghResponse(404))
        .mockResolvedValueOnce(ghResponse(201, { content: { sha: 'f' } }))
        .mockResolvedValueOnce(ghResponse(201, { number: 8, html_url: 'u8' }))
        .mockResolvedValueOnce(ghResponse(200, []));

      const result = await service.createPRWithFile(opts);

      expect(result.prNumber).toBe(8);
      expect(
        fetchMock.mock.calls.some((c) => (c[0] as string).includes('/forks')),
      ).toBe(false); // fork já existia
    });

    it('fork não fica pronto a tempo → 503 com mensagem clara', async () => {
      jest.useFakeTimers();
      fetchMock
        .mockResolvedValueOnce(ghResponse(404)) // não colaborador
        .mockResolvedValueOnce(ghResponse(404)) // fork não existe
        .mockResolvedValueOnce(ghResponse(202, {})) // POST /forks
        .mockResolvedValue(ghResponse(404)); // polls sempre 404

      const assertion = expect(service.createPRWithFile(opts)).rejects.toThrow(
        'não ficou disponível a tempo',
      );
      await jest.advanceTimersByTimeAsync(10_000);
      await assertion;
    });

    it('401 do GitHub → 403 orientando re-login', async () => {
      fetchMock.mockResolvedValueOnce(
        ghResponse(401, { message: 'Bad credentials' }),
      );

      await expect(service.createPRWithFile(opts)).rejects.toThrow(
        ForbiddenException,
      );

      fetchMock.mockResolvedValueOnce(
        ghResponse(401, { message: 'Bad credentials' }),
      );
      await expect(service.createPRWithFile(opts)).rejects.toThrow(
        'faça login novamente',
      );
    });

    it('403 do GitHub → 403 orientando re-login', async () => {
      fetchMock.mockResolvedValueOnce(
        ghResponse(403, { message: 'Forbidden' }),
      );

      await expect(service.createPRWithFile(opts)).rejects.toThrow(
        'faça login novamente',
      );
    });
  });

  // ── createPRDeleteFile ───────────────────────────────────────────────────

  describe('createPRDeleteFile', () => {
    const opts = {
      branch: 'event-override/meetup-devparana-123-1',
      path: 'static/events/meetup/devparana/123.override.json',
      commitMessage: 'event: remove override 123 by @octo',
      prTitle: 'event: remove override 123 by @octo',
      actorHandle: 'octo',
      userToken: TOKEN,
    };

    it('deleta o arquivo na branch e abre PR', async () => {
      fetchMock
        .mockResolvedValueOnce(ghResponse(200, { permission: 'admin' }))
        .mockResolvedValueOnce(ghResponse(200, { object: { sha: 'base' } }))
        .mockResolvedValueOnce(ghResponse(201, {}))
        .mockResolvedValueOnce(ghResponse(200, { sha: 'file-sha' }))
        .mockResolvedValueOnce(ghResponse(200, {}))
        .mockResolvedValueOnce(ghResponse(201, { number: 9, html_url: 'u9' }));

      const result = await service.createPRDeleteFile(opts);

      expect(result).toEqual({ prNumber: 9, prUrl: 'u9' });
      const deleteCall = fetchMock.mock.calls[4];
      expect(deleteCall[1].method).toBe('DELETE');
      expect(JSON.parse(deleteCall[1].body as string)).toMatchObject({
        sha: 'file-sha',
        branch: opts.branch,
      });
    });

    it('arquivo inexistente → 503', async () => {
      fetchMock
        .mockResolvedValueOnce(ghResponse(200, { permission: 'admin' }))
        .mockResolvedValueOnce(ghResponse(200, { object: { sha: 'base' } }))
        .mockResolvedValueOnce(ghResponse(201, {}))
        .mockResolvedValueOnce(ghResponse(404));

      await expect(service.createPRDeleteFile(opts)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  // ── PR lookup ────────────────────────────────────────────────────────────

  describe('getPRForBranch / findOpenPRByBranchPrefix', () => {
    it('getPRForBranch: head default é o owner canônico', async () => {
      fetchMock.mockResolvedValueOnce(
        ghResponse(200, [
          { number: 5, state: 'open', merged_at: null, html_url: 'u5' },
        ]),
      );

      const pr = await service.getPRForBranch('event-override/x', TOKEN);

      expect(pr).toEqual({
        number: 5,
        state: 'open',
        mergedAt: null,
        prUrl: 'u5',
      });
      expect(fetchMock.mock.calls[0][0]).toContain(
        'head=codaqui%3Aevent-override%2Fx',
      );
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
        `Bearer ${TOKEN}`,
      );
    });

    it('getPRForBranch: headOwner customizado (PR vindo de fork)', async () => {
      fetchMock.mockResolvedValueOnce(ghResponse(200, []));

      await service.getPRForBranch('event-override/x', TOKEN, 'octo');

      expect(fetchMock.mock.calls[0][0]).toContain(
        'head=octo%3Aevent-override%2Fx',
      );
    });

    it('findOpenPRByBranchPrefix: match por head.ref (canônico ou fork)', async () => {
      fetchMock.mockResolvedValueOnce(
        ghResponse(200, [
          {
            number: 1,
            state: 'open',
            merged_at: null,
            html_url: 'u1',
            head: { ref: 'other/branch' },
          },
          {
            number: 2,
            state: 'open',
            merged_at: null,
            html_url: 'u2',
            head: { ref: 'event-override/meetup-devparana-123-1700000000000' },
          },
        ]),
      );

      const pr = await service.findOpenPRByBranchPrefix(
        'event-override/meetup-devparana-123-',
        TOKEN,
      );

      expect(pr?.number).toBe(2);
    });
  });

  // ── GITHUB_BASE_BRANCH ───────────────────────────────────────────────────

  describe('base branch configurável', () => {
    beforeEach(() => {
      process.env.GITHUB_BASE_BRANCH = 'develop';
    });

    it('readFile usa a branch da env na URL raw', async () => {
      fetchMock.mockResolvedValueOnce(ghResponse(200, '{}'));

      await service.readFile('static/events/organizers.json');

      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://raw.githubusercontent.com/codaqui/institucional/develop/static/events/organizers.json',
      );
    });

    it('branch e PR usam a base da env (ref + base do PR)', async () => {
      fetchMock
        .mockResolvedValueOnce(ghResponse(200, { permission: 'admin' }))
        .mockResolvedValueOnce(ghResponse(200, { object: { sha: 'base' } }))
        .mockResolvedValueOnce(ghResponse(201, {}))
        .mockResolvedValueOnce(ghResponse(404))
        .mockResolvedValueOnce(ghResponse(201, { content: { sha: 'f' } }))
        .mockResolvedValueOnce(ghResponse(201, { number: 3, html_url: 'u3' }))
        .mockResolvedValueOnce(ghResponse(200, []));

      await service.createPRWithFile({
        branch: 'b1',
        path: 'x.json',
        content: '{}\n',
        commitMessage: 'm',
        prTitle: 't',
        actorHandle: 'octo',
        userToken: TOKEN,
      });

      expect(fetchMock.mock.calls[1][0]).toContain('/git/ref/heads/develop');
      const prBody = JSON.parse(fetchMock.mock.calls[5][1].body as string);
      expect(prBody.base).toBe('develop');
    });
  });

  // ── createPRWithFiles (multi-arquivo, 1 PR) ──────────────────────────────

  describe('createPRWithFiles', () => {
    it('aplica PUTs e DELETEs na mesma branch e abre UM PR', async () => {
      fetchMock
        .mockResolvedValueOnce(ghResponse(200, { permission: 'write' }))
        .mockResolvedValueOnce(ghResponse(200, { object: { sha: 'base' } }))
        .mockResolvedValueOnce(ghResponse(201, {}))
        // arquivo 1: create (404 → PUT sem sha)
        .mockResolvedValueOnce(ghResponse(404))
        .mockResolvedValueOnce(ghResponse(201, { content: { sha: 'a' } }))
        // arquivo 2: delete (sha existe → DELETE)
        .mockResolvedValueOnce(ghResponse(200, { sha: 'old-sha' }))
        .mockResolvedValueOnce(ghResponse(200, {}))
        // arquivo 3: delete de inexistente (404 → skip, sem DELETE)
        .mockResolvedValueOnce(ghResponse(404))
        // PR + labels
        .mockResolvedValueOnce(
          ghResponse(201, { number: 77, html_url: 'https://pr/77' }),
        )
        .mockResolvedValueOnce(ghResponse(200, []));

      const result = await service.createPRWithFiles({
        branch: 'event-sync/internal-1',
        files: [
          {
            path: 'static/events/internal/codaqui/index.json',
            content: '{}\n',
          },
          { path: 'static/events/internal/codaqui/old.json', content: null },
          { path: 'static/events/internal/codaqui/ghost.json', content: null },
        ],
        commitMessage: 'event: sync internal snapshot by @octo',
        prTitle: 'event: sync internal snapshot by @octo',
        actorHandle: 'octo',
        userToken: TOKEN,
        labels: ['event-override'],
      });

      expect(result).toEqual({ prNumber: 77, prUrl: 'https://pr/77' });

      const calls = fetchMock.mock.calls;
      // 1 PUT + 1 DELETE (o delete do inexistente foi pulado)
      const methods = calls.map((c) => c[1]?.method ?? 'GET');
      expect(methods.filter((m) => m === 'PUT')).toHaveLength(1);
      expect(methods.filter((m) => m === 'DELETE')).toHaveLength(1);
      // exatamente 1 PR aberto
      expect(
        calls.filter((c) => (c[0] as string).endsWith('/pulls')),
      ).toHaveLength(1);
      const deleteBody = JSON.parse(calls[6][1].body as string);
      expect(deleteBody.sha).toBe('old-sha');
    });
  });

  // ── listDir ──────────────────────────────────────────────────────────────

  describe('listDir', () => {
    it('retorna nome/path dos arquivos do diretório', async () => {
      fetchMock.mockResolvedValueOnce(
        ghResponse(200, [
          {
            name: 'index.json',
            path: 'static/events/internal/codaqui/index.json',
          },
          { name: 'abc.json', path: 'static/events/internal/codaqui/abc.json' },
        ]),
      );

      const entries = await service.listDir(
        'static/events/internal/codaqui',
        TOKEN,
      );

      expect(entries).toHaveLength(2);
      expect(entries?.[0].name).toBe('index.json');
      expect(fetchMock.mock.calls[0][0]).toContain('?ref=main');
    });

    it('404 (diretório inexistente) → null', async () => {
      fetchMock.mockResolvedValueOnce(ghResponse(404));
      await expect(service.listDir('nope/', TOKEN)).resolves.toBeNull();
    });
  });

  // ── getFileHistory ───────────────────────────────────────────────────────

  describe('getFileHistory', () => {
    it('mapeia os campos do commit para o contrato do endpoint', async () => {
      fetchMock.mockResolvedValueOnce(
        ghResponse(200, [
          {
            sha: 'abc123',
            html_url: 'https://github.com/codaqui/institucional/commit/abc123',
            author: { login: 'octo', avatar_url: 'https://avatars/octo' },
            commit: {
              message: 'event: override 123 by @octo — fix\n\nDetalhes...',
              author: { date: '2026-07-29T10:00:00Z' },
            },
          },
        ]),
      );

      const history = await service.getFileHistory(
        'static/events/meetup/devparana/123.override.json',
        TOKEN,
      );

      expect(history).toEqual([
        {
          sha: 'abc123',
          message: 'event: override 123 by @octo — fix', // só a 1ª linha
          authorHandle: 'octo',
          authorAvatarUrl: 'https://avatars/octo',
          date: '2026-07-29T10:00:00Z',
          url: 'https://github.com/codaqui/institucional/commit/abc123',
        },
      ]);
      expect(fetchMock.mock.calls[0][0]).toContain(
        'path=static%2Fevents%2Fmeetup%2Fdevparana%2F123.override.json',
      );
      expect(fetchMock.mock.calls[0][0]).toContain('sha=main');
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
        `Bearer ${TOKEN}`,
      );
    });

    it('sem token funciona (repo público) e sem commits → []', async () => {
      fetchMock.mockResolvedValueOnce(ghResponse(200, []));

      const history = await service.getFileHistory('x.json');

      expect(history).toEqual([]);
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
    });

    it('404/409 → [] (nunca lança por arquivo inexistente)', async () => {
      fetchMock.mockResolvedValueOnce(ghResponse(404));
      await expect(service.getFileHistory('x.json')).resolves.toEqual([]);

      fetchMock.mockResolvedValueOnce(ghResponse(409));
      await expect(service.getFileHistory('x.json')).resolves.toEqual([]);
    });

    it('401 → 403 orientando re-login', async () => {
      fetchMock.mockResolvedValueOnce(ghResponse(401, { message: 'bad' }));
      await expect(service.getFileHistory('x.json', TOKEN)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
