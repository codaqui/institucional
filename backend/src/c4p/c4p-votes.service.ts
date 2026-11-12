import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { JwtPayload } from '../auth/jwt.strategy';
import { MemberDesignation } from '../designations/entities/member-designation.entity';
import { UpsertC4pVoteDto } from './dto/c4p-vote.dto';
import { C4pCall } from './entities/c4p-call.entity';
import { C4pTalk } from './entities/c4p-talk.entity';
import { C4pVote } from './entities/c4p-vote.entity';

export interface EvaluatorTalkView {
  id: string;
  title: string;
  summary: string;
  level: string | null;
  track: string | null;
  speakerName: string;
  speakerRole: string | null;
  linkedin: string | null;
  bio: string | null;
  photoUrl: string | null;
  spokeBefore: boolean | null;
  myVote: {
    scores: Record<string, number>;
    comment: string | null;
    updatedAt: Date;
  } | null;
}

@Injectable()
export class C4pVotesService {
  constructor(
    @InjectRepository(C4pCall)
    private readonly callsRepo: Repository<C4pCall>,
    @InjectRepository(MemberDesignation)
    private readonly designationsRepo: Repository<MemberDesignation>,
    @InjectRepository(C4pTalk)
    private readonly talksRepo: Repository<C4pTalk>,
    @InjectRepository(C4pVote)
    private readonly votesRepo: Repository<C4pVote>,
  ) {}

  async upsert(
    callId: string,
    talkId: string,
    actor: JwtPayload,
    dto: UpsertC4pVoteDto,
  ): Promise<C4pVote> {
    const call = await this.requireOpenCall(callId);
    const designation = await this.requireActiveDesignation(callId, actor.sub);
    const talk = await this.talksRepo.findOneBy({ id: talkId });
    if (!talk || talk.callId !== callId) {
      throw new NotFoundException('Proposta não encontrada.');
    }
    this.validateScores(call, dto);
    if (dto.comment && dto.comment.length > 2000) {
      throw new BadRequestException('O comentário deve ter no máximo 2000 caracteres.');
    }

    const existing = await this.votesRepo.findOne({
      where: { talkId, evaluatorDesignationId: designation.id },
    });
    if (existing) {
      existing.scores = dto.scores;
      existing.comment = dto.comment ?? null;
      return this.votesRepo.save(existing);
    }
    return this.votesRepo.save(
      this.votesRepo.create({
        talkId,
        evaluatorDesignationId: designation.id,
        scores: dto.scores,
        comment: dto.comment ?? null,
      }),
    );
  }

  async listTalksForEvaluator(
    callId: string,
    actor: JwtPayload,
  ): Promise<EvaluatorTalkView[]> {
    const call = await this.callsRepo.findOneBy({ id: callId });
    if (!call) throw new NotFoundException('Campanha não encontrada.');
    const designation = await this.requireActiveDesignation(callId, actor.sub);

    const talks = await this.talksRepo.find({
      where: { callId },
      order: { createdAt: 'ASC' },
    });
    const votes = await this.votesRepo.find({
      where: { evaluatorDesignationId: designation.id },
    });
    const voteByTalk = new Map(votes.map((vote) => [vote.talkId, vote]));

    return talks.map((talk) => {
      const vote = voteByTalk.get(talk.id);
      return {
        id: talk.id,
        title: talk.title,
        summary: talk.summary,
        level: talk.level,
        track: talk.track,
        speakerName: talk.speakerName,
        speakerRole: talk.speakerRole,
        linkedin: talk.linkedin,
        bio: talk.bio,
        photoUrl: talk.photoUrl,
        spokeBefore: talk.spokeBefore,
        myVote: vote
          ? {
              scores: vote.scores,
              comment: vote.comment,
              updatedAt: vote.updatedAt,
            }
          : null,
      };
    });
  }

  async getEvaluatorCall(
    callId: string,
    actor: JwtPayload,
  ): Promise<{ call: C4pCall; progress: { voted: number; total: number } }> {
    const call = await this.callsRepo.findOneBy({ id: callId });
    if (!call) throw new NotFoundException('Campanha não encontrada.');
    const designation = await this.requireActiveDesignation(callId, actor.sub);

    const talks = await this.talksRepo.find({
      where: { callId },
      select: { id: true },
    });
    const votes = await this.votesRepo.find({
      where: { evaluatorDesignationId: designation.id },
      select: { talkId: true },
    });
    const votedTalkIds = new Set(
      votes.filter((vote) => talks.some((talk) => talk.id === vote.talkId)).map((vote) => vote.talkId),
    );
    return {
      call,
      progress: { voted: votedTalkIds.size, total: talks.length },
    };
  }

  private async requireOpenCall(callId: string): Promise<C4pCall> {
    const call = await this.callsRepo.findOneBy({ id: callId });
    if (!call) throw new NotFoundException('Campanha não encontrada.');
    if (call.status !== 'open') {
      throw new ConflictException('A votação está encerrada nesta chamada.');
    }
    return call;
  }

  private async requireActiveDesignation(
    callId: string,
    memberId: string,
  ): Promise<MemberDesignation> {
    const designation = await this.designationsRepo.findOne({
      where: {
        memberId,
        targetType: 'c4p_campaign',
        targetId: callId,
        designation: 'evaluator',
        status: 'active',
      },
    });
    if (!designation || designation.status !== 'active') {
      throw new ForbiddenException(
        'Você não é avaliador ativo desta campanha.',
      );
    }
    return designation;
  }

  private validateScores(call: C4pCall, dto: UpsertC4pVoteDto): void {
    const entries = Object.entries(dto.scores ?? {});
    if (entries.length === 0) {
      throw new BadRequestException(
        'Informe ao menos um critério avaliado.',
      );
    }
    const validKeys = new Set(call.criteria.map((criterion) => criterion.key));
    for (const [key, value] of entries) {
      if (!validKeys.has(key)) {
        throw new BadRequestException(
          `Critério desconhecido: "${key}".`,
        );
      }
      if (!Number.isInteger(value) || value < 0 || value > 10) {
        throw new BadRequestException(
          'Cada nota deve ser um número inteiro entre 0 e 10.',
        );
      }
    }
  }
}
