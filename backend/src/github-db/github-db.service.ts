import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

export interface CreatePRWithFileOptions {
  branch: string; // nome da branch (ex.: "event-override/meetup-devparana-123-<ts>")
  path: string; // caminho do arquivo no repositório
  content: string; // conteúdo em UTF-8
  commitMessage: string; // ex.: "event: override <eventId> by @<handle> — <reason>"
  prTitle: string;
  actorHandle: string; // handle GitHub do membro (dono do token — autor do commit)
  userToken: string; // token OAuth do membro (scope public_repo)
  labels?: string[]; // ex.: ["event-override"]
}

export interface CreatePRDeleteFileOptions {
  branch: string;
  path: string;
  commitMessage: string;
  prTitle: string;
  actorHandle: string;
  userToken: string;
  labels?: string[];
}

export interface CreatePRWithFilesOptions {
  branch: string;
  /** content null = deletar o arquivo na branch */
  files: Array<{ path: string; content: string | null }>;
  commitMessage: string;
  prTitle: string;
  actorHandle: string;
  userToken: string;
  labels?: string[];
}

export interface FileHistoryEntry {
  sha: string;
  message: string;
  authorHandle: string;
  authorAvatarUrl: string;
  date: string;
  url: string;
}

export interface PRInfo {
  number: number;
  state: string;
  mergedAt: string | null;
  prUrl: string;
}

interface WriteTarget {
  /** owner do repo onde a branch/commit acontecem (canônico ou fork) */
  owner: string;
  /** prefixo do head no PR — vazio no canônico, "{actor}:" no fork */
  headPrefix: string;
}

const GITHUB_API = 'https://api.github.com';
const GITHUB_RAW = 'https://raw.githubusercontent.com';

/** Permissões que autorizam escrever direto no repositório canônico */
const DIRECT_WRITE_PERMISSIONS = new Set(['admin', 'maintain', 'write']);

/** Fork flow: tentativas de poll (2s de intervalo) até o fork existir */
const FORK_POLL_ATTEMPTS = 5;
const FORK_POLL_INTERVAL_MS = 2_000;

/** Mensagem única para token expirado/sem escopo — orienta o re-login */
const RELOGIN_MESSAGE =
  'Autorização do GitHub expirada ou sem escopo — faça login novamente.';

/**
 * GitHub-as-Database — toda leitura/escrita de arquivos do repositório
 * acontece via GitHub API (o container do backend não tem checkout do repo).
 *
 * Modelo de autenticação: **token OAuth do próprio membro logado** (scope
 * `public_repo`, capturado no login e persistido criptografado). Commits e
 * PRs saem em nome do membro — atribuição de contributor no repo público.
 *
 * Leituras são públicas (raw.githubusercontent.com), sem token.
 *
 * Escrita é SEMPRE via branch + PR (nunca commit direto na branch base —
 * `main` em produção, `develop` em dev via env `GITHUB_BASE_BRANCH`):
 * - Colaborador com permissão admin/maintain/write → branch no repo canônico.
 * - Demais membros → fork automático + PR com head "{actor}:{branch}".
 * O workflow `validate-event-overrides.yml` valida e auto-mergeia os PRs
 * com label `event-override` (via GITHUB_TOKEN do Actions).
 */
@Injectable()
export class GitHubDBService {
  private readonly logger = new Logger(GitHubDBService.name);

  // ── Config ─────────────────────────────────────────────────────────────

  private get repoOwner(): string {
    return process.env.GITHUB_REPO_OWNER || 'codaqui';
  }

  private get repoName(): string {
    return process.env.GITHUB_REPO_NAME || 'institucional';
  }

  private get repoBase(): string {
    return `${GITHUB_API}/repos/${this.repoOwner}/${this.repoName}`;
  }

  /**
   * Branch base de leitura/escrita. Em dev os PRs/merges vão para `develop`
   * (env GITHUB_BASE_BRANCH=develop); produção usa o default `main`.
   */
  private get baseBranch(): string {
    return process.env.GITHUB_BASE_BRANCH || 'main';
  }

  // ── HTTP helpers ─────────────────────────────────────────────────────────

  /**
   * Chamada autenticada com o token do membro. 404 → { status: 404, data: null }.
   * 401/403 → ForbiddenException com orientação de re-login (token expirado
   * ou login anterior ao escopo public_repo).
   */
  private async api<T>(
    method: string,
    url: string,
    userToken: string,
    body?: unknown,
  ): Promise<{ status: number; data: T }> {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${userToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (res.status === 404) {
      return { status: 404, data: null as T };
    }
    if (res.status === 401 || res.status === 403) {
      const text = await res.text();
      this.logger.warn(`GitHub API ${method} ${url} → ${res.status}: ${text}`);
      throw new ForbiddenException(RELOGIN_MESSAGE);
    }
    if (!res.ok) {
      const text = await res.text();
      throw new ServiceUnavailableException(
        `GitHub API ${method} ${url} falhou (HTTP ${res.status}): ${text}`,
      );
    }
    return { status: res.status, data: (await res.json()) as T };
  }

  // ── Leitura (pública — sem token) ────────────────────────────────────────

  /** Lê um arquivo da branch base. Retorna o conteúdo UTF-8 ou null se não existir. */
  async readFile(path: string): Promise<string | null> {
    const res = await fetch(
      `${GITHUB_RAW}/${this.repoOwner}/${this.repoName}/${this.baseBranch}/${path}`,
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new ServiceUnavailableException(
        `Falha ao ler ${path} do repositório (HTTP ${res.status}).`,
      );
    }
    return res.text();
  }

  // ── PR lookup (com o token do membro — evita rate limit) ─────────────────

  /**
   * Retorna o PR aberto de uma branch exata, ou null. `headOwner` é o owner
   * do head (canônico ou o handle do membro, quando o PR veio de um fork).
   */
  async getPRForBranch(
    branch: string,
    userToken: string,
    headOwner?: string,
  ): Promise<PRInfo | null> {
    const head = `${headOwner ?? this.repoOwner}:${branch}`;
    const { data: pulls } = await this.api<
      Array<{
        number: number;
        state: string;
        merged_at: string | null;
        html_url: string;
      }>
    >(
      'GET',
      `${this.repoBase}/pulls?head=${encodeURIComponent(head)}&state=open`,
      userToken,
    );
    const pr = pulls?.[0];
    if (!pr) return null;
    return {
      number: pr.number,
      state: pr.state,
      mergedAt: pr.merged_at ?? null,
      prUrl: pr.html_url,
    };
  }

  /**
   * Retorna o PR aberto cuja branch começa com o prefixo (branches de
   * override carregam timestamp no final, então match exato não funciona).
   * Funciona para PRs do canônico e de forks (head.ref é só o nome da branch).
   */
  async findOpenPRByBranchPrefix(
    prefix: string,
    userToken: string,
  ): Promise<PRInfo | null> {
    const { data: pulls } = await this.api<
      Array<{
        number: number;
        state: string;
        merged_at: string | null;
        html_url: string;
        head: { ref: string };
      }>
    >('GET', `${this.repoBase}/pulls?state=open&per_page=100`, userToken);
    const pr = (pulls ?? []).find((p) => p.head?.ref?.startsWith(prefix));
    if (!pr) return null;
    return {
      number: pr.number,
      state: pr.state,
      mergedAt: pr.merged_at ?? null,
      prUrl: pr.html_url,
    };
  }

  // ── Write target: canônico (colaborador) ou fork ─────────────────────────

  /**
   * Decide onde a branch será criada: no repo canônico (se o membro é
   * colaborador com admin/maintain/write) ou num fork do membro.
   */
  private async resolveWriteTarget(
    userToken: string,
    actorHandle: string,
  ): Promise<WriteTarget> {
    const { data } = await this.api<{ permission?: string }>(
      'GET',
      `${this.repoBase}/collaborators/${actorHandle}/permission`,
      userToken,
    );
    if (data?.permission && DIRECT_WRITE_PERMISSIONS.has(data.permission)) {
      return { owner: this.repoOwner, headPrefix: '' };
    }

    // Fork flow: garante que o membro tem um fork do repo canônico
    const forkBase = `${GITHUB_API}/repos/${actorHandle}/${this.repoName}`;
    const fork = await this.api('GET', forkBase, userToken);
    if (fork.status === 404) {
      this.logger.log(
        `Criando fork de ${this.repoOwner}/${this.repoName} para @${actorHandle}`,
      );
      await this.api('POST', `${this.repoBase}/forks`, userToken);
      // O fork é assíncrono — poll até ficar disponível
      let ready = false;
      for (let attempt = 1; attempt <= FORK_POLL_ATTEMPTS; attempt += 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, FORK_POLL_INTERVAL_MS),
        );
        const poll = await this.api('GET', forkBase, userToken);
        if (poll.status === 200) {
          ready = true;
          break;
        }
      }
      if (!ready) {
        throw new ServiceUnavailableException(
          `O fork de @${actorHandle} não ficou disponível a tempo — tente novamente em alguns segundos.`,
        );
      }
    }
    return { owner: actorHandle, headPrefix: `${actorHandle}:` };
  }

  // ── Escrita (sempre branch + PR — nunca commit direto na base) ──────────

  private async createBranchFromBase(
    targetOwner: string,
    branch: string,
    userToken: string,
  ): Promise<void> {
    const base = `${GITHUB_API}/repos/${targetOwner}/${this.repoName}`;
    const { data: ref } = await this.api<{ object: { sha: string } }>(
      'GET',
      `${base}/git/ref/heads/${this.baseBranch}`,
      userToken,
    );
    await this.api('POST', `${base}/git/refs`, userToken, {
      ref: `refs/heads/${branch}`,
      sha: ref.object.sha,
    });
  }

  private async openPR(
    head: string,
    title: string,
    body: string,
    userToken: string,
    labels?: string[],
  ): Promise<{ prNumber: number; prUrl: string }> {
    const { data: pr } = await this.api<{ number: number; html_url: string }>(
      'POST',
      `${this.repoBase}/pulls`,
      userToken,
      { title, head, base: this.baseBranch, body },
    );
    if (labels?.length) {
      await this.api(
        'POST',
        `${this.repoBase}/issues/${pr.number}/labels`,
        userToken,
        { labels },
      );
    }
    return { prNumber: pr.number, prUrl: pr.html_url };
  }

  /**
   * Cria uma branch, commita o arquivo (create ou update) e abre o PR no
   * repo canônico. O commit sai em nome do dono do token (o próprio membro).
   */
  async createPRWithFile(
    opts: CreatePRWithFileOptions,
  ): Promise<{ prNumber: number; prUrl: string }> {
    const target = await this.resolveWriteTarget(
      opts.userToken,
      opts.actorHandle,
    );
    const base = `${GITHUB_API}/repos/${target.owner}/${this.repoName}`;

    await this.createBranchFromBase(target.owner, opts.branch, opts.userToken);

    // Se o arquivo já existe na branch, o PUT exige o sha atual (update)
    const { data: existing } = await this.api<{ sha?: string }>(
      'GET',
      `${base}/contents/${opts.path}?ref=${encodeURIComponent(opts.branch)}`,
      opts.userToken,
    );

    await this.api('PUT', `${base}/contents/${opts.path}`, opts.userToken, {
      message: opts.commitMessage,
      content: Buffer.from(opts.content, 'utf8').toString('base64'),
      branch: opts.branch,
      ...(existing?.sha ? { sha: existing.sha } : {}),
    });

    return this.openPR(
      `${target.headPrefix}${opts.branch}`,
      opts.prTitle,
      `Autoria: @${opts.actorHandle}\nArquivo: \`${opts.path}\``,
      opts.userToken,
      opts.labels,
    );
  }

  /**
   * Cria uma branch, remove o arquivo e abre o PR de delete.
   * Mesmo ciclo: o workflow valida que só *.override.json foi removido e auto-mergeia.
   */
  async createPRDeleteFile(
    opts: CreatePRDeleteFileOptions,
  ): Promise<{ prNumber: number; prUrl: string }> {
    const target = await this.resolveWriteTarget(
      opts.userToken,
      opts.actorHandle,
    );
    const base = `${GITHUB_API}/repos/${target.owner}/${this.repoName}`;

    await this.createBranchFromBase(target.owner, opts.branch, opts.userToken);

    // DELETE exige o sha do arquivo na branch
    const { status, data: existing } = await this.api<{ sha?: string }>(
      'GET',
      `${base}/contents/${opts.path}?ref=${encodeURIComponent(opts.branch)}`,
      opts.userToken,
    );
    if (status === 404 || !existing?.sha) {
      throw new ServiceUnavailableException(
        `Arquivo não encontrado no repositório: ${opts.path}`,
      );
    }

    await this.api('DELETE', `${base}/contents/${opts.path}`, opts.userToken, {
      message: opts.commitMessage,
      sha: existing.sha,
      branch: opts.branch,
    });

    return this.openPR(
      `${target.headPrefix}${opts.branch}`,
      opts.prTitle,
      `Autoria: @${opts.actorHandle}\nRemoção do arquivo: \`${opts.path}\``,
      opts.userToken,
      opts.labels,
    );
  }

  /**
   * Versão multi-arquivo: uma branch, vários commits contents (PUT para
   * create/update, DELETE quando `content` é null) e UM ÚNICO PR no final.
   * Usada pelo force-sync do snapshot internal (N arquivos de evento +
   * index da fonte + index raiz em um PR só).
   */
  async createPRWithFiles(
    opts: CreatePRWithFilesOptions,
  ): Promise<{ prNumber: number; prUrl: string }> {
    const target = await this.resolveWriteTarget(
      opts.userToken,
      opts.actorHandle,
    );
    const base = `${GITHUB_API}/repos/${target.owner}/${this.repoName}`;

    await this.createBranchFromBase(target.owner, opts.branch, opts.userToken);

    for (const file of opts.files) {
      const { status, data: existing } = await this.api<{ sha?: string }>(
        'GET',
        `${base}/contents/${file.path}?ref=${encodeURIComponent(opts.branch)}`,
        opts.userToken,
      );
      if (file.content === null) {
        // Delete: ignora se o arquivo já não existe na branch
        if (status === 404 || !existing?.sha) continue;
        await this.api(
          'DELETE',
          `${base}/contents/${file.path}`,
          opts.userToken,
          {
            message: opts.commitMessage,
            sha: existing.sha,
            branch: opts.branch,
          },
        );
      } else {
        await this.api('PUT', `${base}/contents/${file.path}`, opts.userToken, {
          message: opts.commitMessage,
          content: Buffer.from(file.content, 'utf8').toString('base64'),
          branch: opts.branch,
          ...(existing?.sha ? { sha: existing.sha } : {}),
        });
      }
    }

    return this.openPR(
      `${target.headPrefix}${opts.branch}`,
      opts.prTitle,
      `Autoria: @${opts.actorHandle}\nArquivos: ${opts.files.length} (${opts.files.filter((f) => f.content === null).length} remoções)`,
      opts.userToken,
      opts.labels,
    );
  }

  /**
   * Lista os arquivos de um diretório na branch base (contents API).
   * 404 (diretório inexistente) → null.
   */
  async listDir(
    path: string,
    userToken: string,
  ): Promise<Array<{ name: string; path: string }> | null> {
    const { status, data } = await this.api<
      Array<{ name: string; path: string }>
    >(
      'GET',
      `${this.repoBase}/contents/${path}?ref=${this.baseBranch}`,
      userToken,
    );
    if (status === 404 || !Array.isArray(data)) return null;
    return data.map((entry) => ({ name: entry.name, path: entry.path }));
  }

  /**
   * Histórico de commits de um arquivo (proxy da commits API). Com token do
   * membro quando disponível (evita rate limit); sem token funciona porque o
   * repo é público. Sem commits → [] (nunca 404).
   */
  async getFileHistory(
    path: string,
    userToken?: string | null,
  ): Promise<FileHistoryEntry[]> {
    const url = `${this.repoBase}/commits?path=${encodeURIComponent(path)}&sha=${this.baseBranch}&per_page=20`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
      },
    });
    if (res.status === 404 || res.status === 409) return []; // 409 = branch vazio
    if (res.status === 401 || res.status === 403) {
      throw new ForbiddenException(RELOGIN_MESSAGE);
    }
    if (!res.ok) {
      throw new ServiceUnavailableException(
        `GitHub API GET ${url} falhou (HTTP ${res.status}).`,
      );
    }
    const commits = (await res.json()) as Array<{
      sha: string;
      html_url: string;
      author: { login?: string; avatar_url?: string } | null;
      commit: { message: string; author?: { date?: string } };
    }>;
    if (!Array.isArray(commits)) return [];
    return commits.map((c) => ({
      sha: c.sha,
      message: c.commit?.message?.split('\n')[0] ?? '',
      authorHandle: c.author?.login ?? '',
      authorAvatarUrl: c.author?.avatar_url ?? '',
      date: c.commit?.author?.date ?? '',
      url: c.html_url,
    }));
  }
}
