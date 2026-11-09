import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Raw, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import type { JwtPayload } from '../auth/jwt.strategy';
import { EmailService } from '../notifications/email.service';
import { parseDateTimeLocal } from '../events/events.service';
import { MentorAvailability } from './entities/mentor-availability.entity';
import { MentorProfile } from './entities/mentor-profile.entity';
import { MentorshipSession, MentorshipSessionStatus } from './entities/mentorship-session.entity';
import { AvailabilityRuleDto, ReserveSlotDto } from './dto/mentorship.dto';

export interface AvailabilitySlot {
  scheduledAt: string;
  durationMin: number;
  timeZone: string;
}

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(MentorAvailability)
    private readonly availabilityRepo: Repository<MentorAvailability>,
    @InjectRepository(MentorshipSession)
    private readonly sessionRepo: Repository<MentorshipSession>,
    @InjectRepository(MentorProfile)
    private readonly profileRepo: Repository<MentorProfile>,
    private readonly emailService: EmailService,
  ) {}

  async replaceAvailability(weekday: number, rules: AvailabilityRuleDto[], actor: JwtPayload) {
    const profile = await this.profileRepo.findOneBy({ memberId: actor.sub, active: true });
    if (!profile) throw new ForbiddenException('É necessário ser um mentor ativo.');
    const existing = await this.availabilityRepo.find({ where: { mentorId: profile.id, weekday } });
    for (const rule of rules) {
      const duration = this.durationMinutes(rule.startTime, rule.endTime);
      if (duration <= 0) throw new ConflictException('O início deve ser anterior ao fim.');
      for (const other of existing) {
        if (this.timesOverlap(rule.startTime, rule.endTime, other.startTime, other.endTime)) {
          throw new ConflictException('As regras de disponibilidade se sobrepõem.');
        }
      }
      existing.push({ startTime: rule.startTime, endTime: rule.endTime } as MentorAvailability);
    }
    await this.availabilityRepo.delete({ mentorId: profile.id, weekday });
    return this.availabilityRepo.save(rules.map((rule) => this.availabilityRepo.create({
      mentorId: profile.id,
      weekday,
      startTime: rule.startTime,
      endTime: rule.endTime,
      timeZone: rule.timeZone ?? 'America/Sao_Paulo',
    })));
  }

  async listAvailability(mentorId: string, from = new Date()): Promise<AvailabilitySlot[]> {
    const rules = await this.availabilityRepo.find({ where: { mentorId } });
    const until = new Date(from.getTime() + 28 * 86_400_000);
    const sessions = await this.sessionRepo.find({
      where: {
        mentorId,
        status: In([MentorshipSessionStatus.REQUESTED, MentorshipSessionStatus.CONFIRMED]),
        scheduledAt: Raw((alias) => `${alias} >= :from AND ${alias} < :until`, { from, until }),
      },
    });
    const slots: AvailabilitySlot[] = [];
    for (const rule of rules) {
      for (let day = 0; day < 28; day += 1) {
        const date = new Date(from.getTime() + day * 86_400_000);
        const localDate = date.toLocaleDateString('en-CA', { timeZone: rule.timeZone });
        const weekday = Number(new Intl.DateTimeFormat('en-US', { timeZone: rule.timeZone, weekday: 'short' })
          .formatToParts(date).find((part) => part.type === 'weekday')?.value === 'Sun' ? 0 : date.getDay());
        if (weekday !== rule.weekday) continue;
        const scheduledAt = `${localDate}T${rule.startTime}`;
        const startAt = parseDateTimeLocal(scheduledAt, rule.timeZone);
        if (startAt <= from) continue;
        const durationMin = this.durationMinutes(rule.startTime, rule.endTime);
        const endAt = new Date(startAt.getTime() + durationMin * 60_000);
        const occupied = sessions.some((session) => session.scheduledAt < endAt
          && new Date(session.scheduledAt.getTime() + session.durationMin * 60_000) > startAt);
        if (!occupied) slots.push({ scheduledAt, durationMin, timeZone: rule.timeZone });
      }
    }
    return slots;
  }

  async reserveSlot(input: ReserveSlotDto, actor?: JwtPayload): Promise<MentorshipSession> {
    const profile = await this.profileRepo.findOneBy({ id: input.mentorId, active: true });
    if (!profile) throw new ConflictException('Mentor indisponível.');
    const startAt = parseDateTimeLocal(input.scheduledAt, 'America/Sao_Paulo');
    if (startAt <= new Date()) throw new ConflictException('Escolha um horário futuro.');
    const endAt = new Date(startAt.getTime() + input.durationMin * 60_000);
    const weekday = startAt.getDay();
    if (!actor && !input.guestConsentAt) throw new ConflictException('Consentimento obrigatório.');

    try {
      return await this.sessionRepo.manager.transaction(async (manager) => {
        const repo = manager.getRepository(MentorshipSession);
        const rule = await manager.getRepository(MentorAvailability).findOneBy({
          mentorId: input.mentorId,
          weekday,
          startTime: input.scheduledAt.slice(11, 16),
          endTime: input.scheduledAt.slice(11, 16) === '' ? '' : this.endTime(input.scheduledAt, input.durationMin),
        });
        if (!rule) throw new ConflictException('Este horário não está disponível.');
        const conflict = await repo.findOne({
          where: {
            mentorId: input.mentorId,
            status: In([MentorshipSessionStatus.REQUESTED, MentorshipSessionStatus.CONFIRMED]),
            scheduledAt: Raw((alias) => `${alias} < :endAt AND (${alias} + ("durationMin" * INTERVAL '1 minute')) > :startAt`, { startAt, endAt }),
          },
        });
        if (conflict) throw new ConflictException('Este horário já está reservado.');
        return repo.save(repo.create({
          mentorId: input.mentorId,
          menteeName: input.menteeName.trim(),
          menteeEmail: input.menteeEmail.trim().toLowerCase(),
          menteeMemberId: actor?.sub ?? null,
          topicTags: input.topicTags,
          scheduledAt: startAt,
          durationMin: input.durationMin,
          timeZone: 'America/Sao_Paulo',
          status: MentorshipSessionStatus.REQUESTED,
          token: randomUUID(),
          guestConsentAt: actor ? null : input.guestConsentAt,
        }));
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('Este horário já está reservado.');
      }
      throw error;
    }
  }

  private durationMinutes(startTime: string, endTime: string): number {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    return (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  }

  private endTime(scheduledAt: string, durationMin: number): string {
    const [hour, minute] = scheduledAt.slice(11, 16).split(':').map(Number);
    const total = hour * 60 + minute + durationMin;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  private timesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
    return startA < endB && endA > startB;
  }
}
