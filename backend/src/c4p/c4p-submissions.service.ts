import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailService } from '../notifications/email.service';
import { EMAIL_TEMPLATE_C4P_SUBMISSION_CONFIRMATION } from '../notifications/default-templates';
import { C4pCallsService } from './c4p-calls.service';
import { SubmitC4pTalkDto } from './dto/c4p-submission.dto';
import { C4pCall } from './entities/c4p-call.entity';
import { C4pTalk } from './entities/c4p-talk.entity';

function assertHttpsUrl(value: string | undefined, field: string): void {
  if (!value) return;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new BadRequestException(`${field} deve ser uma URL válida.`);
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new BadRequestException(
      `${field} deve usar HTTPS e não conter credenciais.`,
    );
  }
}

@Injectable()
export class C4pSubmissionsService {
  private readonly logger = new Logger(C4pSubmissionsService.name);

  constructor(
    private readonly calls: C4pCallsService,
    @InjectRepository(C4pTalk)
    private readonly talksRepo: Repository<C4pTalk>,
    private readonly emailService: EmailService,
  ) {}

  async submit(
    slug: string,
    dto: SubmitC4pTalkDto,
  ): Promise<{ id: string }> {
    const call = await this.calls.getBySlug(slug);
    this.assertAccepting(call);
    if (dto.consent !== true) {
      throw new BadRequestException(
        'O consentimento para tratamento dos dados é obrigatório.',
      );
    }
    assertHttpsUrl(dto.linkedin, 'O LinkedIn');
    assertHttpsUrl(dto.photoUrl, 'A URL da foto');

    const saved = await this.talksRepo.save(
      this.talksRepo.create({
        callId: call.id,
        speakerName: dto.speakerName,
        speakerEmail: dto.speakerEmail,
        speakerPhone: dto.speakerPhone ?? null,
        speakerRole: dto.speakerRole ?? null,
        linkedin: dto.linkedin ?? null,
        spokeBefore: dto.spokeBefore ?? null,
        title: dto.title,
        summary: dto.summary,
        level: dto.level ?? null,
        track: dto.track ?? null,
        bio: dto.bio ?? null,
        photoUrl: dto.photoUrl ?? null,
        extraNotes: dto.extraNotes ?? null,
        origin: 'public_form',
        consentAt: new Date(),
      }),
    );

    this.sendConfirmation(call, saved).catch((error: Error) =>
      this.logger.warn(
        `Falha ao enviar confirmação de submissão ${saved.id}: ${error.message}`,
      ),
    );

    return { id: saved.id };
  }

  private assertAccepting(call: C4pCall): void {
    const now = Date.now();
    const withinWindow =
      (!call.submissionOpenAt || call.submissionOpenAt.getTime() <= now) &&
      (!call.submissionCloseAt || call.submissionCloseAt.getTime() > now);
    if (call.status !== 'open' || !withinWindow) {
      throw new ConflictException(
        'Esta chamada não está aceitando submissões.',
      );
    }
  }

  private async sendConfirmation(
    call: C4pCall,
    talk: C4pTalk,
  ): Promise<void> {
    await this.emailService.sendTemplate(
      EMAIL_TEMPLATE_C4P_SUBMISSION_CONFIRMATION,
      talk.speakerEmail,
      {
        attendeeName: talk.speakerName,
        eventTitle: call.name,
        eventStartAt: new Date(),
        eventTimeZone: 'America/Sao_Paulo',
        c4pCallName: call.name,
        c4pTalkTitle: talk.title,
      },
      { eventId: null, registrationId: talk.id },
    );
  }
}
