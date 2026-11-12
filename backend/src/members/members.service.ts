import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { EventRegistration } from '../events/entities/event-registration.entity';
import { MentorshipSession } from '../mentorship/entities/mentorship-session.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { DERIVED_ROLES } from '../designations/designations.service';
import { Member, MemberRole } from './entities/member.entity';
import { PaginatedResultDto } from '../ledger/dto/paginated-result.dto';
import { Transaction } from '../ledger/entities/transaction.entity';
import { EventsService } from '../events/events.service';
import { decryptToken, encryptToken } from '../common/crypto.util';
import {
  applyProfileVisibility,
  PROFILE_VISIBILITY_FIELDS,
  resolveProfileVisibility,
} from './profile-visibility';
import type { UpdateProfileVisibilityDto } from './dto/update-profile-visibility.dto';
import type { PublicMember } from './profile-visibility';

interface GithubProfile {
  githubId: string;
  githubHandle: string;
  name: string;
  /** E-mail de exibição; não autoriza vínculo sem confirmação da API. */
  email: string;
  avatarUrl: string;
  /** Token OAuth do GitHub (scope public_repo) — persistido criptografado */
  githubAccessToken?: string;
  /** E-mails verificados da conta GitHub (match de participantes CSV e guests) */
  secondaryEmails?: string[];
}

interface UpdateMeDto {
  bio?: string;
  linkedinUrl?: string;
}

interface AdminUpdateDto {
  roles?: MemberRole[];
  isActive?: boolean;
  name?: string;
  bio?: string;
  linkedinUrl?: string;
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
    @Inject(forwardRef(() => EventsService))
    private readonly eventsService: EventsService,
    private readonly dataSource: DataSource,
    @InjectRepository(EventRegistration)
    private readonly registrationRepo: Repository<EventRegistration>,
    @InjectRepository(MentorshipSession)
    private readonly mentorshipSessionRepo: Repository<MentorshipSession>,
    private readonly auditService: AuditService,
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

    // O token NUNCA é persistido em texto puro — separado do spread e
    // criptografado abaixo (encryptToken; em dev sem a env vira `plain:`).
    const { githubAccessToken, secondaryEmails, ...profileData } = profile;

    let member = await this.repo.findOne({
      where: { githubId: profileData.githubId },
    });
    let isNew = false;

    if (member) {
      this.applyExistingMemberUpdates(member, profileData, isBootstrapAdmin);
    } else {
      isNew = true;
      member = this.createNewMember(profileData, isBootstrapAdmin);
    }

    this.applyEncryptedToken(member, githubAccessToken);
    this.applySecondaryEmails(member, secondaryEmails);

    const saved = await this.repo.save(member);

    if (isNew) {
      await this.safeRematchPendingRegistrations(saved);
    }
    await this.safeLinkGuestRegistrations(saved);
    await this.safeLinkMentorshipSessions(saved);

    return saved;
  }

  private async safeLinkMentorshipSessions(member: Member): Promise<void> {
    const emails = [...new Set(
      (member.secondaryEmails ?? [])
        .filter(Boolean)
        .map((email) => email.toLowerCase()),
    )];
    if (emails.length === 0) return;
    try {
      await this.mentorshipSessionRepo.update(
        { menteeMemberId: IsNull(), menteeEmail: In(emails) },
        { menteeMemberId: member.id },
      );
    } catch (error) {
      this.logger.warn(`Falha ao vincular sessões de mentoria: ${String(error)}`);
    }
  }

  private async safeLinkGuestRegistrations(member: Member): Promise<void> {
    try {
      const emails = [...new Set(
        (member.secondaryEmails ?? [])
          .filter(Boolean)
          .map((email) => email.toLowerCase()),
      )];
      if (emails.length === 0) return;
      const guests = await this.registrationRepo.find({
        where: { isGuest: true, memberId: IsNull(), attendeeEmail: In(emails) },
      });
      const guestsByEvent = new Map<string, EventRegistration[]>();
      for (const guest of guests) {
        if (!guest.eventId) continue;
        const eventGuests = guestsByEvent.get(guest.eventId) ?? [];
        eventGuests.push(guest);
        guestsByEvent.set(guest.eventId, eventGuests);
      }
      await Promise.all(
        [...guestsByEvent.values()].map((eventGuests) =>
          eventGuests.reduce(
            (previous, guest) => previous.then(() => this.linkGuestAndAudit(guest, member)),
            Promise.resolve(),
          ),
        ),
      );
    } catch (error) {
      this.logger.warn(`Falha ao vincular inscrições guest: ${String(error)}`);
    }
  }

  private async linkGuestAndAudit(guest: EventRegistration, member: Member): Promise<void> {
    if (!guest.eventId) return;
    const result = await this.eventsService.linkGuestRegistration(guest, member.id);
    if (result === 'skipped') return;
    void this.auditService.log({
      action: AuditAction.EVENT_GUEST_LINKED,
      actorId: member.id,
      actorHandle: member.githubHandle,
      targetId: guest.id,
      targetType: 'event-registration',
      details: {
        eventId: guest.eventId,
        duplicateCancelled: result === 'duplicate_cancelled',
      },
    });
  }

  private applyExistingMemberUpdates(
    member: Member,
    profileData: Omit<GithubProfile, 'githubAccessToken' | 'secondaryEmails'>,
    isBootstrapAdmin: boolean,
  ): void {
    // Atualiza dados públicos que podem ter mudado no GitHub
    member.githubHandle = profileData.githubHandle;
    member.name = profileData.name;
    member.email = profileData.email;
    member.avatarUrl = profileData.avatarUrl;

    // Garante role admin para bootstrap admins a cada login
    if (isBootstrapAdmin && !member.roles.includes(MemberRole.ADMIN)) {
      this.logger.log(
        `Bootstrap admin restaurado: @${profileData.githubHandle} → role=admin`,
      );
      member.roles = [...member.roles, MemberRole.ADMIN];
    }
  }

  private createNewMember(
    profileData: Omit<GithubProfile, 'githubAccessToken' | 'secondaryEmails'>,
    isBootstrapAdmin: boolean,
  ): Member {
    const member = this.repo.create({
      ...profileData,
      roles: isBootstrapAdmin ? [MemberRole.ADMIN] : [MemberRole.MEMBRO],
      isActive: true,
    });

    if (isBootstrapAdmin) {
      this.logger.log(
        `Bootstrap admin criado: @${profileData.githubHandle} → role=admin`,
      );
    }

    return member;
  }

  private applyEncryptedToken(
    member: Member,
    githubAccessToken: string | undefined,
  ): void {
    // Atualiza o token a CADA login (rotação natural do OAuth + garante o
    // novo escopo public_repo assim que o usuário re-consente)
    if (githubAccessToken) {
      member.githubAccessToken = encryptToken(githubAccessToken);
    }
  }

  private applySecondaryEmails(
    member: Member,
    secondaryEmails: string[] | undefined,
  ): void {
    // E-mails verificados: atualiza a cada login quando a API respondeu
    // (undefined = falha na API → preserva o que já estava gravado)
    if (secondaryEmails) {
      member.secondaryEmails = secondaryEmails;
    }
  }

  private async safeRematchPendingRegistrations(member: Member): Promise<void> {
    // Hook 2d: membro NOVO resolve inscrições pending_match de eventos
    // externos (match por e-mail/githubHandle). Nunca quebra o login.
    try {
      await this.eventsService.rematchPendingRegistrationsForMember(member);
    } catch (error: unknown) {
      this.logger.warn(
        `Falha no rematch de inscrições para @${member.githubHandle}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Token OAuth do GitHub do membro, DESCRIPTOGRAFADO — uso interno apenas
   * (GitHubDBService). NUNCA expor em endpoint/DTO. Retorna null se o membro
   * não existir ou ainda não tiver token gravado (login antigo, pré-scope).
   */
  async getGithubAccessToken(memberId: string): Promise<string | null> {
    // select explícito: a coluna tem select:false na entidade (proteção
    // contra vazamento acidental em serializações)
    const member = await this.repo.findOne({
      where: { id: memberId },
      select: ['id', 'githubAccessToken'],
    });
    if (!member?.githubAccessToken) return null;
    return decryptToken(member.githubAccessToken);
  }

  /** Lista membros ativos (endpoint público, paginado) */
  async findAllActive(
    page = 1,
    limit = 50,
  ): Promise<PaginatedResultDto<PublicMember>> {
    // safeLimit consistente: take, skip e totalPages usam o MESMO limite
    // efetivo (cap de 100). Antes, take usava o cap mas skip/totalPages usavam
    // o limit bruto — paginação quebrada para limit > 100.
    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100);
    const [data, total] = await this.repo.findAndCount({
      where: { isActive: true },
      select: [
        'id',
        'githubHandle',
        'name',
        'avatarUrl',
        'bio',
        'linkedinUrl',
        'roles',
        'joinedAt',
        'profileVisibility',
      ],
      order: { joinedAt: 'ASC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit, // hard cap at 100 per page
    });
    return {
      data: data.map(applyProfileVisibility),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  findMe(id: string): Promise<Member | null> {
    return this.repo.findOne({ where: { id, isActive: true } });
  }

  /** Perfil individual (endpoint público) */
  async findOne(id: string) {
    const member = await this.repo.findOne({
      where: { id, isActive: true },
      select: [
        'id',
        'githubHandle',
        'name',
        'avatarUrl',
        'bio',
        'linkedinUrl',
        'roles',
        'joinedAt',
        'profileVisibility',
      ],
    });
    return member ? applyProfileVisibility(member) : null;
  }

  /** Busca membro ativo pelo handle do GitHub (público) */
  async findByHandle(handle: string) {
    const member = await this.repo.findOne({
      where: { githubHandle: handle, isActive: true },
      select: [
        'id',
        'githubHandle',
        'name',
        'avatarUrl',
        'bio',
        'linkedinUrl',
        'roles',
        'joinedAt',
        'profileVisibility',
      ],
    });
    return member ? applyProfileVisibility(member) : null;
  }

  /**
   * Busca múltiplos membros ativos por handles do GitHub.
   * Útil para sites de comunidades enriquecerem cards de equipe/embaixadores
   * sem precisar carregar todos os membros.
   *
   * Não expõe busca por e-mail para evitar enumeração de endereços.
   * O tamanho do batch é validado no DTO.
   */
  async findByHandles(handles: string[]): Promise<PublicMember[]> {
    const normalizedHandles = handles
      .map((h) => h.trim().toLowerCase())
      .filter((h) => MembersService.HANDLE_REGEX.test(h));

    if (normalizedHandles.length === 0) {
      return [];
    }

    const members = await this.repo
      .createQueryBuilder('m')
      .where('m.isActive = true')
      .andWhere('LOWER(m.githubHandle) IN (:...handles)', { handles: normalizedHandles })
      .select([
        'm.id',
        'm.githubHandle',
        'm.name',
        'm.avatarUrl',
        'm.bio',
        'm.linkedinUrl',
        'm.roles',
        'm.joinedAt',
        'm.profileVisibility',
      ])
      .orderBy('m.name', 'ASC')
      .getMany();
    return members.map(applyProfileVisibility);
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

  async getProfileVisibility(id: string) {
    const member = await this.repo.findOneOrFail({
      where: { id },
      select: [
        'id',
        'email',
        'secondaryEmails',
        'marketingEmailOptIn',
        'profileVisibility',
      ],
    });
    const emails = this.collectNormalizedMemberEmails(member);
    const marketingSuppressed = await this.hasUnsubscribeSuppression(emails);
    return {
      visibility: resolveProfileVisibility(member.profileVisibility),
      fields: PROFILE_VISIBILITY_FIELDS,
      marketingEmailOptIn: Boolean(member.marketingEmailOptIn),
      marketingSuppressed,
    };
  }

  private collectNormalizedMemberEmails(
    member: Pick<Member, 'email' | 'secondaryEmails'>,
  ): string[] {
    return [
      ...new Set(
        [member.email, ...(member.secondaryEmails ?? [])]
          .filter((value): value is string => Boolean(value?.trim()))
          .map((value) => value.trim().toLowerCase()),
      ),
    ];
  }

  private async hasUnsubscribeSuppression(emails: string[]): Promise<boolean> {
    if (emails.length === 0) return false;
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      const rows = (await queryRunner.query(
        'SELECT source FROM email_suppressions WHERE "emailNormalized" = ANY($1::text[])',
        [emails],
      )) as Array<{ source?: string }> | undefined;
      if (!Array.isArray(rows)) return false;
      return rows.some((row) => row.source === 'unsubscribe');
    } catch {
      return false;
    } finally {
      await queryRunner.release();
    }
  }

  async updateMarketingConsent(
    id: string,
    dto: Readonly<{
      marketingEmailOptIn: boolean;
      confirmReactivation?: boolean;
    }>,
  ) {
    const member = await this.repo.findOneOrFail({
      where: { id },
      select: [
        'id',
        'email',
        'secondaryEmails',
        'marketingEmailOptIn',
        'profileVisibility',
      ],
    });
    const emails = this.collectNormalizedMemberEmails(member);
    const suppressed = await this.hasUnsubscribeSuppression(emails);
    const nextOptIn = Boolean(dto.marketingEmailOptIn);

    if (nextOptIn && suppressed) {
      if (!dto.confirmReactivation) {
        throw new ConflictException(
          'Este endereço realizou descadastro anteriormente. Confirme explicitamente a reativação pelo titular para voltar a receber comunicações promocionais.',
        );
      }
      const queryRunner = this.dataSource.createQueryRunner();
      try {
        await queryRunner.connect();
        await queryRunner.query(
          'DELETE FROM email_suppressions WHERE "emailNormalized" = ANY($1::text[]) AND source = $2',
          [emails, 'unsubscribe'],
        );
      } finally {
        await queryRunner.release();
      }
    }

    await this.repo.update({ id }, { marketingEmailOptIn: nextOptIn });
    return {
      marketingEmailOptIn: nextOptIn,
      marketingSuppressed: nextOptIn && dto.confirmReactivation ? false : suppressed,
    };
  }

  async updateProfileVisibility(
    id: string,
    dto: Readonly<UpdateProfileVisibilityDto>,
  ) {
    const member = await this.repo.findOneOrFail({
      where: { id },
      select: ['id', 'profileVisibility'],
    });
    resolveProfileVisibility(dto);
    const visibility = {
      ...member.profileVisibility,
      ...dto,
    };
    await this.repo.update({ id }, { profileVisibility: visibility });
    return this.getProfileVisibility(id);
  }

  /** Admin: lista todos (incluindo inativos) */
  findAll(): Promise<Member[]> {
    return this.repo.find({ order: { joinedAt: 'DESC' } });
  }

  /**
   * Admin: atualizar role ou isActive.
   * Roles derivadas só mudam pelo sync de designations. Bootstrap admins que
   * fizerem login novamente terão role=admin restaurada automaticamente.
   */
  async adminUpdate(
    id: string,
    dto: Readonly<AdminUpdateDto>,
  ): Promise<Member> {
    if ('marketingEmailOptIn' in (dto as Record<string, unknown>)) {
      throw new ForbiddenException(
        'O consentimento promocional pertence exclusivamente ao titular e não pode ser alterado por administrador.',
      );
    }
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        id,
      ]);
      const repo = queryRunner.manager.getRepository(Member);
      const member = await repo.findOneOrFail({ where: { id } });

      if (dto.roles) {
        const previousRoles = new Set(member.roles);
        const nextRoles = new Set(dto.roles);
        const changesDerivedRole = DERIVED_ROLES.some(
          (role) =>
            previousRoles.has(role as MemberRole) !==
            nextRoles.has(role as MemberRole),
        );
        if (changesDerivedRole) {
          throw new ConflictException(
            'role derivada — gerida pelo sync de designations',
          );
        }
      }

      await repo.update(id, dto);
      const updated = await repo.findOneOrFail({ where: { id } });
      await queryRunner.commitTransaction();
      return updated;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ── Doadores ──────────────────────────────────────────────────────────────

  /**
   * Lista membros que fizeram pelo menos uma doação, ordenados por total doado.
   * Cruza members com transactions via padrão [memberId] na descrição.
   */
  async findDonors(
    page = 1,
    limit = 50,
  ): Promise<
    PaginatedResultDto<{
      id: string;
      githubHandle: string;
      name: string;
      avatarUrl: string;
      bio?: string | null;
      linkedinUrl?: string | null;
      roles?: string[];
      joinedAt?: Date;
      totalDonated: number;
      lastDonatedAt: Date;
      donationCount: number;
    }>
  > {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const offset = (safePage - 1) * safeLimit;

    // Query doadores: junta members com transactions via padrão [memberId]
    const rawDonors = await this.txRepo
      .createQueryBuilder('tx')
      .innerJoin('members', 'm', "tx.description LIKE '%[' || m.id || ']%'")
      .where('m."isActive" = true')
      .andWhere("COALESCE(m.\"profileVisibility\"->>'donations', 'true') = 'true'")
      .select([
        'm.id AS id',
        'm."githubHandle" AS "githubHandle"',
        'm.name AS name',
        'm."avatarUrl" AS "avatarUrl"',
        'm.bio AS bio',
        'm."linkedinUrl" AS "linkedinUrl"',
        'm.roles AS roles',
        'm."joinedAt" AS "joinedAt"',
        'm."profileVisibility" AS "profileVisibility"',
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
      .addGroupBy('m.roles')
      .addGroupBy('m."joinedAt"')
      .addGroupBy('m."profileVisibility"')
      .orderBy('"totalDonated"', 'DESC')
      .offset(offset)
      .limit(safeLimit)
      .getRawMany();

    // Count total de doadores distintos
    const countResult = await this.txRepo
      .createQueryBuilder('tx')
      .innerJoin('members', 'm', "tx.description LIKE '%[' || m.id || ']%'")
      .where('m."isActive" = true')
      .andWhere("COALESCE(m.\"profileVisibility\"->>'donations', 'true') = 'true'")
      .select('COUNT(DISTINCT m.id)', 'count')
      .getRawOne();

    const total = Number.parseInt(countResult?.count ?? '0', 10);

    return {
      data: rawDonors.map((r) => ({
        id: r.id,
        githubHandle: r.githubHandle,
        name: r.name,
        avatarUrl: r.avatarUrl,
        bio: applyProfileVisibility(r).bio,
        linkedinUrl: applyProfileVisibility(r).linkedinUrl,
        roles: applyProfileVisibility(r).roles,
        joinedAt: applyProfileVisibility(r).joinedAt as Date,
        totalDonated: Number.parseFloat(r.totalDonated) || 0,
        lastDonatedAt: new Date(r.lastDonatedAt),
        donationCount: Number.parseInt(r.donationCount, 10) || 0,
      })),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  /**
   * Lista doações públicas de um membro específico.
   * Retorna comunidade destino, valor, data e tipo.
   */
  async findMemberDonations(memberId: string): Promise<
    Array<{
      id: string;
      amount: number;
      community: string;
      communityKey: string;
      type: string;
      createdAt: Date;
    }>
  > {
    const member = await this.repo.findOne({
      where: { id: memberId },
      select: ['id', 'profileVisibility'],
    });
    if (!resolveProfileVisibility(member?.profileVisibility).donations) {
      return [];
    }

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
      if (tx.description.includes('empresarial'))
        type = 'Assinatura mensal (Empresa)';
      else if (tx.description.includes('Assinatura mensal'))
        type = 'Assinatura mensal';
      else if (tx.description.includes('Assinatura anual'))
        type = 'Assinatura anual';

      return {
        id: tx.id,
        amount: Number.parseFloat(String(tx.amount)),
        community: tx.destinationAccount?.name ?? 'Comunidade',
        communityKey: tx.destinationAccount?.projectKey ?? '',
        type,
        createdAt: tx.createdAt,
      };
    });
  }
}
