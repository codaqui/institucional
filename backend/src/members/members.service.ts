import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Member, MemberRole } from './entities/member.entity';

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
  ) {}

  /**
   * Cria ou atualiza membro com dados frescos do GitHub.
   * Chamado no callback OAuth a cada login.
   *
   * Bootstrap admins (BOOTSTRAP_ADMINS) têm role=admin garantida sempre —
   * mesmo que alguém altere no banco, é restaurado no próximo login.
   */
  async upsertByGithub(profile: Readonly<GithubProfile>): Promise<Member> {
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

  /** Perfil completo do usuário logado */
  findByGithubId(githubId: string): Promise<Member | null> {
    return this.repo.findOne({ where: { githubId } });
  }

  /** Atualiza dados editáveis pelo próprio membro (busca por githubId — legado) */
  async updateMe(githubId: string, dto: Readonly<UpdateMeDto>): Promise<Member> {
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
  async adminUpdate(id: string, dto: Readonly<AdminUpdateDto>): Promise<Member> {
    await this.repo.update(id, dto);
    return this.repo.findOneOrFail({ where: { id } });
  }
}
