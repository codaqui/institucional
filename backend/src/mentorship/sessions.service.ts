import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { JwtPayload } from '../auth/jwt.strategy';
import { HoursService } from '../hours/hours.service';
import { EmailService } from '../notifications/email.service';
import { MemberRole } from '../members/entities/member.entity';
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
    return this.sessionRepo.find({ where: { mentorId: (await this.requireMentor(actor)).id }, order: { scheduledAt: 'DESC' } });
  }

  async listForAdmin(actor: JwtPayload, page = 1, limit = 25) {
    if (!actor.roles?.includes(MemberRole.ADMIN)) throw new ForbiddenException('Somente admin pode listar todas as sessões.');
    const [data, total] = await this.sessionRepo.findAndCount({
      order: { scheduledAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, totalPages: Math.ceil(total / limit), limit };
  }

  async confirm(id: string, meetLink: string, actor: JwtPayload) {
    if (!meetLink.startsWith('https://')) throw new BadRequestException('O link da sessão deve usar HTTPS.');
    const session = await this.requireSession(id);
    await this.assertMentor(session, actor);
    if (session.status !== MentorshipSessionStatus.REQUESTED) {
      throw new ConflictException('Somente sessões solicitadas podem ser confirmadas.');
    }
    session.status = MentorshipSessionStatus.CONFIRMED;
    session.meetLink = meetLink;
    await this.emailService.sendTemplate(
      'mentorship-confirmed',
      session.menteeEmail,
      {
        attendeeName: session.menteeName,
        eventTitle: 'Mentoria Codaqui',
        eventStartAt: session.scheduledAt,
        eventTimeZone: session.timeZone,
        meetLink,
      },
      { eventId: null, registrationId: session.id },
    );
    return this.sessionRepo.save(session);
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
    return this.sessionRepo.save(session);
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
    return this.sessionRepo.save(session);
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
    const profile = await this.requireMentor(actor);
    if (session.mentorId !== profile.id) {
      throw new ForbiddenException('Somente o mentor da sessão pode executar esta ação.');
    }
    return profile;
  }
}
