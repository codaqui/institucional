import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Member, MemberRole } from './entities/member.entity';
import { Transaction } from '../ledger/entities/transaction.entity';

interface GithubProfile {
  githubId: string;
  githubHandle: string;
  name: string;
  email: string;
  avatarUrl: string;
}

interface UpdateMeDto {
  bio?: string;
  linkedinUrl?: string;
}

interface AdminUpdateDto {
  role?: MemberRole;
  isActive?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap Admins — Admin 0
//
// Lista de GitHub handles que são garantidamente admin independente do banco.
// Esses usuários têm role=admin forçada a cada login OAuth, o que significa:
//   - Não podem perder acesso admin acidentalmente via painel
//   - Funcionam mesmo em banco zerado (ex: restore de catástrofe)
//   - São o "bootstrap" do sistema — podem promover outros admins pelo painel
//
// Para adicionar um novo bootstrap admin, inclua o handle (lowercase) abaixo.
// ─────────────────────────────────────────────────────────────────────────────
const BOOTSTRAP_ADMINS = new Set<string>([
  'endersonmenezes', // Admin 0 — fundador da Codaqui
]);

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(
    @InjectRepository(Member)
    private readonly repo: Repository<Member>,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
  ) {}

  private static readonly HANDLE_REGEX = /^[a-zA-Z0-9_-]+$/;

  /**
   * Cria ou atualiza membro com dados frescos do GitHub.
   * Chamado no callback OAuth a cada login.
   *
   * Bootstrap admins (BOOTSTRAP_ADMINS) têm role=admin garantida sempre —
   * mesmo que alguém altere no banco, é restaurado no próximo login.
   */
  async upsertByGithub(profile: Readonly<GithubProfile>): Promise<Member> {
    if (!MembersService.HANDLE_REGEX.test(profile.githubHandle)) {
      throw new Error(`Handle GitHub inválido: ${profile.githubHandle}`);
    }

    const isBootstrapAdmin = BOOTSTRAP_ADMINS.has(
      profile.githubHandle.toLowerCase(),
    );

    let member = await this.repo.findOne({
      where: { githubId: profile.githubId },
    });

    if (member) {
      // Atualiza dados públicos que podem ter mudado no GitHub
      member.githubHandle = profile.githubHandle;
      member.name = profile.name;
      member.email = profile.email;
      member.avatarUrl = profile.avatarUrl;

      // Garante role admin para bootstrap admins a cada login
      if (isBootstrapAdmin && member.role !== MemberRole.ADMIN) {
        this.logger.log(
          `Bootstrap admin restaurado: @${profile.githubHandle} → role=admin`,
        );
        member.role = MemberRole.ADMIN;
      }
    } else {
      member = this.repo.create({
        ...profile,
        role: isBootstrapAdmin ? MemberRole.ADMIN : MemberRole.MEMBRO,
        isActive: true,
      });

      if (isBootstrapAdmin) {
        this.logger.log(
          `Bootstrap admin criado: @${profile.githubHandle} → role=admin`,
        );
      }
    }

    return this.repo.save(member);
  }

  /** Lista membros ativos (endpoint público, paginado) */
  async findAllActive(
    page = 1,
    limit = 50,
  ): Promise<{
    data: Member[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const [data, total] = await this.repo.findAndCount({
      where: { isActive: true },
      select: [
        'id',
        'githubHandle',
        'name',
        'avatarUrl',
        'bio',
        'linkedinUrl',
        'role',
        'joinedAt',
      ],
      order: { joinedAt: 'ASC' },
      skip: (page - 1) * limit,
      take: Math.min(limit, 100), // hard cap at 100 per page
    });
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  /** Perfil individual (endpoint público) */
  findOne(id: string): Promise<Member | null> {
    return this.repo.findOne({
      where: { id, isActive: true },
      select: [
        'id',
        'githubHandle',
        'name',
        'avatarUrl',
        'bio',
        'linkedinUrl',
        'role',
        'joinedAt',
      ],
    });
  }

  /** Busca membro ativo pelo handle do GitHub (público) */
  findByHandle(handle: string): Promise<Member | null> {
    return this.repo.findOne({
      where: { githubHandle: handle, isActive: true },
      select: [
        'id',
        'githubHandle',
        'name',
        'avatarUrl',
        'bio',
        'linkedinUrl',
        'role',
        'joinedAt',
      ],
    });
  }

  /** Perfil completo do usuário logado */
  findByGithubId(githubId: string): Promise<Member | null> {
    return this.repo.findOne({ where: { githubId } });
  }

  /** Atualiza dados editáveis pelo próprio membro (busca por githubId — legado) */
  async updateMe(
    githubId: string,
    dto: Readonly<UpdateMeDto>,
  ): Promise<Member> {
    await this.repo.update({ githubId }, dto);
    return this.repo.findOneOrFail({ where: { githubId } });
  }

  /** Atualiza dados editáveis pelo próprio membro (busca por UUID — atual) */
  async updateMeById(id: string, dto: Readonly<UpdateMeDto>): Promise<Member> {
    await this.repo.update({ id }, dto);
    return this.repo.findOneOrFail({ where: { id } });
  }

  /** Admin: lista todos (incluindo inativos) */
  findAll(): Promise<Member[]> {
    return this.repo.find({ order: { joinedAt: 'DESC' } });
  }

  /**
   * Admin: atualizar role ou isActive.
   * Nota: bootstrap admins que fizerem login novamente terão role=admin
   * restaurada automaticamente — a restrição é por design.
   */
  async adminUpdate(
    id: string,
    dto: Readonly<AdminUpdateDto>,
  ): Promise<Member> {
    await this.repo.update(id, dto);
    return this.repo.findOneOrFail({ where: { id } });
  }

  // ── Doadores ──────────────────────────────────────────────────────────────

  /**
   * Lista membros que fizeram pelo menos uma doação, ordenados por total doado.
   * Cruza members com transactions via padrão [memberId] na descrição.
   */
  async findDonors(
    page = 1,
    limit = 50,
  ): Promise<{
    data: Array<{
      id: string;
      githubHandle: string;
      name: string;
      avatarUrl: string;
      bio: string | null;
      linkedinUrl: string | null;
      role: string;
      joinedAt: Date;
      totalDonated: number;
      lastDonatedAt: Date;
      donationCount: number;
    }>;
    total: number;
    page: number;
    totalPages: number;
  }> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const offset = (safePage - 1) * safeLimit;

    // Query doadores: junta members com transactions via padrão [memberId]
    const rawDonors = await this.txRepo
      .createQueryBuilder('tx')
      .innerJoin('members', 'm', "tx.description LIKE '%[' || m.id || ']%'")
      .where('m."isActive" = true')
      .select([
        'm.id AS id',
        'm."githubHandle" AS "githubHandle"',
        'm.name AS name',
        'm."avatarUrl" AS "avatarUrl"',
        'm.bio AS bio',
        'm."linkedinUrl" AS "linkedinUrl"',
        'm.role AS role',
        'm."joinedAt" AS "joinedAt"',
        'COALESCE(SUM(tx.amount), 0) AS "totalDonated"',
        'MAX(tx."createdAt") AS "lastDonatedAt"',
        'COUNT(tx.id) AS "donationCount"',
      ])
      .groupBy('m.id')
      .addGroupBy('m."githubHandle"')
      .addGroupBy('m.name')
      .addGroupBy('m."avatarUrl"')
      .addGroupBy('m.bio')
      .addGroupBy('m."linkedinUrl"')
      .addGroupBy('m.role')
      .addGroupBy('m."joinedAt"')
      .orderBy('"totalDonated"', 'DESC')
      .offset(offset)
      .limit(safeLimit)
      .getRawMany();

    // Count total de doadores distintos
    const countResult = await this.txRepo
      .createQueryBuilder('tx')
      .innerJoin('members', 'm', "tx.description LIKE '%[' || m.id || ']%'")
      .where('m."isActive" = true')
      .select('COUNT(DISTINCT m.id)', 'count')
      .getRawOne();

    const total = parseInt(countResult?.count ?? '0', 10);

    return {
      data: rawDonors.map((r) => ({
        id: r.id,
        githubHandle: r.githubHandle,
        name: r.name,
        avatarUrl: r.avatarUrl,
        bio: r.bio,
        linkedinUrl: r.linkedinUrl,
        role: r.role,
        joinedAt: new Date(r.joinedAt),
        totalDonated: parseFloat(r.totalDonated) || 0,
        lastDonatedAt: new Date(r.lastDonatedAt),
        donationCount: parseInt(r.donationCount, 10) || 0,
      })),
      total,
      page: safePage,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  /**
   * Lista doações públicas de um membro específico.
   * Retorna comunidade destino, valor, data e tipo.
   */
  async findMemberDonations(
    memberId: string,
  ): Promise<
    Array<{
      id: string;
      amount: number;
      community: string;
      communityKey: string;
      type: string;
      createdAt: Date;
    }>
  > {
    const rows = await this.txRepo
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.destinationAccount', 'dst')
      .where('tx.description LIKE :pattern', {
        pattern: `%[${memberId}]%`,
      })
      .orderBy('tx.createdAt', 'DESC')
      .getMany();

    return rows.map((tx) => {
      let type = 'Doação única';
      if (tx.description.includes('Assinatura mensal')) type = 'Assinatura mensal';
      else if (tx.description.includes('Assinatura anual')) type = 'Assinatura anual';

      return {
        id: tx.id,
        amount: parseFloat(String(tx.amount)),
        community: tx.destinationAccount?.name ?? 'Comunidade',
        communityKey: tx.destinationAccount?.projectKey ?? '',
        type,
        createdAt: tx.createdAt,
      };
    });
  }
}
