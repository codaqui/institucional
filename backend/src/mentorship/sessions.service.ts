import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, LessThan, Like, Not, Repository } from 'typeorm';
import type { JwtPayload } from '../auth/jwt.strategy';
import { HoursService } from '../hours/hours.service';
import { EmailService } from '../notifications/email.service';
import { EMAIL_TEMPLATE_MENTORSHIP_CONFIRMED_MENTOR } from '../notifications/default-templates';
import { Member, MemberRole } from '../members/entities/member.entity';
import { buildMentorshipCalendar } from './calendar';
import { MentorProfile } from './entities/mentor-profile.entity';
import { MentorshipSession, MentorshipSessionStatus } from './entities/mentorship-session.entity';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(MentorshipSession)
    private readonly sessionRepo: Repository<MentorshipSession>,
    @InjectRepository(MentorProfile)
    private readonly profileRepo: Repository<MentorProfile>,
    private readonly hours: HoursService,
    private readonly emailService: EmailService,
    @InjectRepository(Member)
    private readonly memberRepo: Repository<Member>,
  ) {}

  async getByToken(token: string) {
    const session = await this.sessionRepo.findOneBy({ token });
    if (!session) throw new NotFoundException('Sessão não encontrada.');
    return {
      scheduledAt: session.scheduledAt,
      durationMin: session.durationMin,
      timeZone: session.timeZone,
      status: session.status,
      meetLink: session.meetLink,
      menteeName: session.menteeName,
      menteeEmail: session.menteeEmail,
      topicTags: session.topicTags,
      rating: session.rating,
      feedback: session.feedback,
      cancelReason: session.cancelReason,
    };
  }

  async listForMentor(actor: JwtPayload) {
    await this.requireMentor(actor);
    const sessions = await this.sessionRepo.find({ where: { mentorId: (await this.requireMentor(actor)).id }, order: { scheduledAt: 'DESC' } });
    return this.withMenteeMembers(sessions);
  }

  async listForAdmin(actor: JwtPayload, page = 1, limit = 25) {
    if (!actor.roles?.includes(MemberRole.ADMIN)) throw new ForbiddenException('Somente admin pode listar todas as sessões.');
    const [sessions, total] = await this.sessionRepo.findAndCount({
      order: { scheduledAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const data = await this.withMenteeMembers(sessions);
    return { data, total, page, totalPages: Math.ceil(total / limit), limit };
  }

  async assignMentee(id: string, memberId: string, actor: JwtPayload) {
    const session = await this.requireSession(id);
    await this.assertMentor(session, actor);
    const member = await this.memberRepo.findOneBy({ id: memberId, isActive: true });
    if (!member) throw new NotFoundException('Membro ativo não encontrado.');
    session.menteeMemberId = member.id;
    const saved = await this.sessionRepo.save(session);
    const [enriched] = await this.withMenteeMembers([saved]);
    return enriched;
  }

  async confirm(id: string, meetLink: string, actor: JwtPayload) {
    if (!meetLink.startsWith('https://')) throw new BadRequestException('O link da sessão deve usar HTTPS.');
    const session = await this.requireSession(id);
    const profile = await this.assertMentor(session, actor);
    if (session.status !== MentorshipSessionStatus.REQUESTED) {
      throw new ConflictException('Somente sessões solicitadas podem ser confirmadas.');
    }
    session.status = MentorshipSessionStatus.CONFIRMED;
    session.meetLink = meetLink;
    const saved = await this.sessionRepo.save(session);
    try {
      await this.notifyConfirmed(saved, profile, meetLink);
    } catch (error) {
      Logger.warn(`Sessão ${session.id} confirmada, mas a notificação falhou: ${String(error)}`, SessionsService.name);
    }
    return saved;
  }

  /** Avisa mentorado e mentor com o mesmo ICS; falha de um não bloqueia o outro. */
  private async notifyConfirmed(session: MentorshipSession, profile: MentorProfile, meetLink: string): Promise<void> {
    const calendar = buildMentorshipCalendar(session);
    const refs = { eventId: null, registrationId: session.id };
    const attachments = [calendar.attachment];
    try {
      await this.emailService.sendTemplate(
        'mentorship-confirmed',
        session.menteeEmail,
        {
          attendeeName: session.menteeName,
          eventTitle: 'Mentoria Codaqui',
          eventStartAt: session.scheduledAt,
          eventTimeZone: session.timeZone,
          meetLink,
          sessionUrl: calendar.sessionUrl,
          calendarUrl: calendar.calendarUrl,
        },
        refs,
        attachments,
      );
    } catch (error) {
      Logger.warn(`Sessão ${session.id} confirmada, mas a notificação ao mentorado falhou: ${String(error)}`, SessionsService.name);
    }
    const mentor = await this.memberRepo.findOneBy({ id: profile.memberId });
    if (!mentor?.email) return;
    try {
      await this.emailService.sendTemplate(
        EMAIL_TEMPLATE_MENTORSHIP_CONFIRMED_MENTOR,
        mentor.email,
        {
          attendeeName: mentor.name,
          menteeName: session.menteeName,
          eventTitle: 'Mentoria Codaqui',
          eventStartAt: session.scheduledAt,
          eventTimeZone: session.timeZone,
          meetLink,
          sessionUrl: calendar.sessionUrl,
          calendarUrl: calendar.calendarUrl,
        },
        refs,
        attachments,
      );
    } catch (error) {
      Logger.warn(`Sessão ${session.id} confirmada, mas a notificação ao mentor falhou: ${String(error)}`, SessionsService.name);
    }
  }

  async complete(id: string, actor: JwtPayload) {
    const session = await this.requireSession(id);
    const profile = await this.assertMentor(session, actor);
    if (session.status !== MentorshipSessionStatus.CONFIRMED) {
      throw new ConflictException('Somente sessões confirmadas podem ser concluídas.');
    }
    if (session.scheduledAt > new Date()) throw new ConflictException('A sessão ainda não ocorreu.');
    await this.hours.recordMentorshipSession({ ...session, mentorId: profile.memberId });
    session.status = MentorshipSessionStatus.COMPLETED;
    session.completedAt = new Date();
    return this.sessionRepo.save(session);
  }

  async noShow(id: string, actor: JwtPayload) {
    const session = await this.requireSession(id);
    await this.assertMentor(session, actor);
    if (session.status !== MentorshipSessionStatus.CONFIRMED) {
      throw new ConflictException('Somente sessões confirmadas podem virar no-show.');
    }
    if (session.scheduledAt > new Date()) throw new ConflictException('A sessão ainda não ocorreu.');
    session.status = MentorshipSessionStatus.NO_SHOW;
    return this.sessionRepo.save(session);
  }

  async cancel(id: string, reason: string, actor?: JwtPayload) {
    if (reason.trim().length < 3 || reason.trim().length > 500) {
      throw new BadRequestException('Informe um motivo de 3 a 500 caracteres.');
    }
    const session = await this.requireSession(id);
    if (actor) await this.assertMentor(session, actor);
    if (![MentorshipSessionStatus.REQUESTED, MentorshipSessionStatus.CONFIRMED].includes(session.status)) {
      throw new ConflictException('Esta sessão não pode mais ser cancelada.');
    }
    session.status = MentorshipSessionStatus.CANCELED;
    session.cancelReason = reason.trim();
    const saved = await this.sessionRepo.save(session);
    try {
      await this.emailService.sendTemplate(
        'mentorship-cancelled',
        session.menteeEmail,
        {
          attendeeName: session.menteeName,
          eventTitle: 'Mentoria Codaqui',
          eventStartAt: session.scheduledAt,
          eventTimeZone: session.timeZone,
          cancelReason: session.cancelReason,
        },
        { eventId: null, registrationId: session.id },
      );
    } catch (error) {
      Logger.warn(`Sessão ${session.id} cancelada, mas a notificação falhou: ${String(error)}`, SessionsService.name);
    }
    return saved;
  }

  async rate(token: string, rating: number, feedback?: string) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('A avaliação deve ser entre 1 e 5.');
    }
    const session = await this.sessionRepo.findOneBy({ token });
    if (!session) throw new NotFoundException('Sessão não encontrada.');
    if (session.status !== MentorshipSessionStatus.COMPLETED) {
      throw new ConflictException('Somente sessões concluídas podem ser avaliadas.');
    }
    session.rating = rating;
    session.feedback = feedback?.trim() || null;
    await this.sessionRepo.save(session);
    return this.getByToken(token);
  }

  async cancelByToken(token: string, reason: string) {
    const session = await this.sessionRepo.findOneBy({ token });
    if (!session) throw new NotFoundException('Sessão não encontrada.');
    await this.cancel(session.id, reason);
    return this.getByToken(token);
  }

  @Cron('20 9 * * *')
  async sendDayBeforeReminders(): Promise<void> {
    const now = Date.now();
    const sessions = await this.sessionRepo.find({
      where: {
        status: MentorshipSessionStatus.CONFIRMED,
        scheduledAt: Between(
          new Date(now + 12 * 3_600_000),
          new Date(now + 36 * 3_600_000),
        ),
      },
    });
    await Promise.all(sessions
      .filter((session) => session.meetLink)
      .map((session) => {
        const calendar = buildMentorshipCalendar(session);
        return this.emailService.sendTemplate(
          'mentorship-reminder-d1',
          session.menteeEmail,
          {
            attendeeName: session.menteeName,
            eventTitle: 'Mentoria Codaqui',
            eventStartAt: session.scheduledAt,
            eventTimeZone: session.timeZone,
            meetLink: session.meetLink,
            sessionUrl: calendar.sessionUrl,
            calendarUrl: calendar.calendarUrl,
          },
          { eventId: null, registrationId: session.id },
        );
      }));
  }

  @Cron('30 3 * * *')
  async anonymizeExpiredGuests(): Promise<void> {
    const cutoff = new Date(Date.now() - 365 * 24 * 3_600_000);
    const guests = await this.sessionRepo.find({
      where: {
        menteeMemberId: IsNull(),
        scheduledAt: LessThan(cutoff),
        menteeEmail: Not(Like('anon-%@anon.invalid')),
      },
    });
    await Promise.all(guests.map((guest) => {
      guest.menteeName = 'Participante anonimizado';
      guest.menteeEmail = `anon-${guest.id}@anon.invalid`;
      return this.sessionRepo.save(guest);
    }));
    if (guests.length > 0) {
      Logger.log(`${guests.length} sessões de convidados anonimizadas após 12 meses.`, SessionsService.name);
    }
  }

  private async withMenteeMembers(sessions: MentorshipSession[]) {
    const memberIds = [
      ...new Set(
        sessions
          .map((session) => session.menteeMemberId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const members = memberIds.length
      ? await this.memberRepo.findBy({ id: In(memberIds), isActive: true })
      : [];
    const membersById = new Map(members.map((member) => [member.id, member]));
    return sessions.map((session) => {
      const member = session.menteeMemberId
        ? membersById.get(session.menteeMemberId)
        : undefined;
      return {
        ...session,
        menteeMember: member
          ? {
              id: member.id,
              name: member.name,
              githubHandle: member.githubHandle,
              avatarUrl: member.avatarUrl,
            }
          : null,
      };
    });
  }

  private async requireSession(id: string): Promise<MentorshipSession> {
    const session = await this.sessionRepo.findOneBy({ id });
    if (!session) throw new NotFoundException('Sessão não encontrada.');
    return session;
  }

  private async requireMentor(actor: JwtPayload): Promise<MentorProfile> {
    const profile = await this.profileRepo.findOneBy({ memberId: actor.sub, active: true });
    if (!profile) throw new ForbiddenException('É necessário ser um mentor ativo.');
    return profile;
  }

  private async assertMentor(session: MentorshipSession, actor: JwtPayload): Promise<MentorProfile> {
    if (actor.roles?.includes(MemberRole.ADMIN)) {
      const profile = await this.profileRepo.findOneBy({ id: session.mentorId, active: true });
      if (!profile) throw new ForbiddenException('O mentor da sessão não está ativo.');
      return profile;
    }
    const profile = await this.requireMentor(actor);
    if (session.mentorId !== profile.id) {
      throw new ForbiddenException('Somente o mentor da sessão pode executar esta ação.');
    }
    return profile;
  }
}
