import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { JwtPayload } from '../auth/jwt.strategy';
import { ExternalEventActivation } from '../events/entities/external-event-activation.entity';
import { ManagedEvent } from '../events/entities/managed-event.entity';
import { EventsService } from '../events/events.service';
import { C4pCallsService } from './c4p-calls.service';
import { CreateEventC4pCallDto } from './dto/c4p-call.dto';
import { C4pCall } from './entities/c4p-call.entity';

@Injectable()
export class EventC4pService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ManagedEvent)
    private readonly managedEventsRepo: Repository<ManagedEvent>,
    @InjectRepository(ExternalEventActivation)
    private readonly activationsRepo: Repository<ExternalEventActivation>,
    @InjectRepository(C4pCall)
    private readonly callsRepo: Repository<C4pCall>,
    private readonly calls: C4pCallsService,
    private readonly events: EventsService,
  ) {}

  async createForManagedEvent(
    eventId: string,
    dto: CreateEventC4pCallDto,
    actor: JwtPayload,
  ): Promise<C4pCall> {
    const event = await this.managedEventsRepo.findOneBy({ id: eventId });
    if (!event) throw new NotFoundException('Evento não encontrado.');
    await this.events.assertCanEditManagedEvent(eventId, actor);

    const existing = await this.callsRepo.findOneBy({
      managedEventId: eventId,
    });
    if (existing) return existing;

    return this.recoverConcurrent(
      () => this.callsRepo.findOneBy({ managedEventId: eventId }),
      () =>
        this.dataSource.transaction((manager) =>
          this.calls.create(
            { ...this.toCallDto(dto), managedEventId: eventId },
            actor,
            manager,
          ),
        ),
    );
  }

  async createForExternalEvent(
    eventKey: string,
    dto: CreateEventC4pCallDto,
    actor: JwtPayload,
  ): Promise<C4pCall> {
    await this.events.assertCanManageExternalEvent(eventKey, actor);
    const activation = await this.activationsRepo.findOneBy({ eventKey });
    if (activation) {
      const existingCall = await this.callsRepo.findOneBy({
        externalActivationId: activation.id,
      });
      if (existingCall) return existingCall;
    }
    if (!activation && !dto.communityProjectKey?.trim()) {
      throw new BadRequestException(
        'communityProjectKey é obrigatório na primeira ativação externa.',
      );
    }

    return this.recoverConcurrent(
      async () => {
        const current = activation ?? await this.activationsRepo.findOneBy({ eventKey });
        return current
          ? this.callsRepo.findOneBy({ externalActivationId: current.id })
          : null;
      },
      () =>
        this.dataSource.transaction(async (manager) => {
          const repo = manager.getRepository(ExternalEventActivation);
          const current =
            activation ??
            repo.create({
              eventKey,
              features: [],
              communityProjectKey: dto.communityProjectKey!,
              enabledByMemberId: actor.sub,
            });
          current.features = [...new Set([...current.features, 'c4p'])];
          if (!activation) {
            current.communityProjectKey = dto.communityProjectKey!;
          }
          if (dto.title !== undefined) current.title = dto.title;
          if (dto.startAt !== undefined) current.startAt = new Date(dto.startAt);
          const savedActivation = await repo.save(current);

          return this.calls.create(
            {
              ...this.toCallDto(dto),
              externalActivationId: savedActivation.id,
            },
            actor,
            manager,
          );
        }),
    );
  }

  private async recoverConcurrent(
    findExisting: () => Promise<C4pCall | null>,
    operation: () => Promise<C4pCall>,
  ): Promise<C4pCall> {
    try {
      return await operation();
    } catch (error) {
      if ((error as { code?: string }).code !== '23505') throw error;
      const existing = await findExisting();
      if (existing) return existing;
      throw error;
    }
  }

  private toCallDto(dto: CreateEventC4pCallDto) {
    const {
      communityProjectKey: _communityProjectKey,
      title: _title,
      startAt: _startAt,
      ...callDto
    } = dto;
    return callDto;
  }
}
