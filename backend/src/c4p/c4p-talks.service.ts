import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import type { JwtPayload } from '../auth/jwt.strategy';
import { PaginatedResultDto } from '../ledger/dto/paginated-result.dto';
import { CsvParseError } from '../common/csv-tokenizer';
import { C4pCallsService } from './c4p-calls.service';
import { C4pCsvSkipped, C4pCsvTalkRow, parseC4pCsv } from './csv';
import { ListC4pTalksDto } from './dto/c4p-talk.dto';
import { C4pTalk } from './entities/c4p-talk.entity';

@Injectable()
export class C4pTalksService {
  constructor(
    private readonly calls: C4pCallsService,
    @InjectRepository(C4pTalk)
    private readonly talksRepo: Repository<C4pTalk>,
    private readonly audit: AuditService,
  ) {}

  async importCsv(
    callId: string,
    csvText: string,
    actor: JwtPayload,
  ): Promise<{ imported: number; skipped: C4pCsvSkipped[] }> {
    const call = await this.calls.getManage(callId, actor);

    let parsed: { rows: C4pCsvTalkRow[]; skipped: C4pCsvSkipped[] };
    try {
      parsed = parseC4pCsv(csvText);
    } catch (error) {
      if (error instanceof CsvParseError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const talks = parsed.rows.map((row) =>
      this.talksRepo.create({
        callId: call.id,
        speakerName: row.speakerName,
        speakerEmail: row.speakerEmail,
        speakerPhone: row.speakerPhone ?? null,
        speakerRole: row.speakerRole ?? null,
        linkedin: row.linkedin ?? null,
        spokeBefore: row.spokeBefore,
        title: row.title,
        summary: row.summary ?? '',
        level: row.level ?? null,
        track: row.track ?? null,
        bio: row.bio ?? null,
        photoUrl: row.photoUrl ?? null,
        extraNotes: row.extraNotes ?? null,
        origin: 'csv_import',
        consentAt: null,
      }),
    );
    if (talks.length > 0) {
      await this.talksRepo.save(talks);
    }

    await this.audit.log({
      action: AuditAction.C4P_TALK_IMPORTED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: call.id,
      targetType: 'c4p_call',
      details: { imported: talks.length, skipped: parsed.skipped },
    });

    return { imported: talks.length, skipped: parsed.skipped };
  }

  async listTalks(
    callId: string,
    query: ListC4pTalksDto,
    actor: JwtPayload,
  ): Promise<PaginatedResultDto<C4pTalk>> {
    await this.calls.getManage(callId, actor);
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const limit = Math.min(Math.max(1, Math.floor(query.limit ?? 50)), 100);

    const qb = this.talksRepo
      .createQueryBuilder('talk')
      .where('talk.callId = :callId', { callId })
      .orderBy('talk.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (query.search?.trim()) {
      qb.andWhere(
        '(talk.title ILIKE :search OR talk.speakerName ILIKE :search)',
        { search: `%${query.search.trim()}%` },
      );
    }
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, totalPages: Math.ceil(total / limit), limit };
  }

  async deleteTalk(
    callId: string,
    talkId: string,
    actor: JwtPayload,
  ): Promise<void> {
    await this.calls.getManage(callId, actor);
    const talk = await this.talksRepo.findOneBy({ id: talkId });
    if (!talk || talk.callId !== callId) {
      throw new NotFoundException('Proposta não encontrada.');
    }
    await this.talksRepo.delete({ id: talkId });
    await this.audit.log({
      action: AuditAction.C4P_TALK_DELETED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: talkId,
      targetType: 'c4p_talk',
      details: { callId, title: talk.title },
    });
  }
}
