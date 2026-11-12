import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { JwtPayload } from '../auth/jwt.strategy';
import { Community } from '../communities/entities/community.entity';
import { MemberDesignation } from '../designations/entities/member-designation.entity';
import { ManagedEvent } from '../events/entities/managed-event.entity';
import { Member } from '../members/entities/member.entity';
import { C4pCallsService } from './c4p-calls.service';
import { computeTalkScore, rankTalks } from './c4p-scoring';
import { Criterion } from './entities/c4p-call.entity';
import { C4pCall } from './entities/c4p-call.entity';
import { C4pTalk } from './entities/c4p-talk.entity';
import { C4pVote } from './entities/c4p-vote.entity';

export interface C4pDashboard {
  totals: {
    talks: number;
    evaluators: number;
    votes: number;
    expected: number;
    completionPercent: number;
  };
  progressByEvaluator: Array<{
    designationId: string;
    member: { name: string; handle: string };
    done: number;
    total: number;
    complete: boolean;
  }>;
  ranking: Array<{
    talkId: string;
    position: number | null;
    title: string;
    speakerName: string;
    track: string | null;
    level: string | null;
    avgTotal: number | null;
    votesCount: number;
    avgCriteria: Record<string, number>;
    selected: boolean;
  }>;
  criteriaAverages: Array<{ key: string; label: string; average: number }>;
  byTrack: Array<{ value: string; count: number }>;
  byLevel: Array<{ value: string; count: number }>;
}

export interface C4pReport {
  call: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    finalizedAt: Date | null;
  };
  criteria: Criterion[];
  selectedTalkIds: string[];
  ranking: C4pDashboard['ranking'];
  votes: Array<{
    talkId: string;
    evaluatorName: string;
    scores: Record<string, number>;
    comment: string | null;
    updatedAt: Date;
  }>;
}

export interface C4pSnapshotCall {
  slug: string;
  name: string;
  description: string | null;
  status: C4pCall['status'];
  submissionOpenAt: Date | null;
  submissionCloseAt: Date | null;
  publicResults: boolean;
  finalizedAt: Date | null;
  community: { slug: string; name: string } | null;
  event: { slug: string; title: string } | null;
  results: {
    talks: Array<{
      title: string;
      speakerName: string;
      track: string | null;
      level: string | null;
    }>;
  } | null;
}

export interface C4pSnapshotPayload {
  generatedAt: string;
  calls: C4pSnapshotCall[];
}

@Injectable()
export class C4pDashboardService {
  constructor(
    private readonly calls: C4pCallsService,
    @InjectRepository(C4pCall)
    private readonly callsRepo: Repository<C4pCall>,
    @InjectRepository(C4pTalk)
    private readonly talksRepo: Repository<C4pTalk>,
    @InjectRepository(C4pVote)
    private readonly votesRepo: Repository<C4pVote>,
    @InjectRepository(MemberDesignation)
    private readonly designationsRepo: Repository<MemberDesignation>,
    @InjectRepository(Member)
    private readonly membersRepo: Repository<Member>,
    @InjectRepository(Community)
    private readonly communitiesRepo: Repository<Community>,
    @InjectRepository(ManagedEvent)
    private readonly eventsRepo: Repository<ManagedEvent>,
  ) {}

  async dashboard(callId: string, actor: JwtPayload): Promise<C4pDashboard> {
    const call = await this.calls.getManage(callId, actor);
    const { talks, votes, activeDesignations } =
      await this.loadCallData(callId);

    const activeIds = new Set(activeDesignations.map((d) => d.id));
    const votesInCall = votes.filter((vote) =>
      talks.some((talk) => talk.id === vote.talkId),
    );

    const progressByEvaluator = await this.buildProgress(
      activeDesignations,
      votesInCall,
      talks.length,
    );

    const ranking = this.buildRanking(call, talks, votes);
    const criteriaAverages = this.buildCriteriaAverages(call.criteria, ranking);

    return {
      totals: {
        talks: talks.length,
        evaluators: activeIds.size,
        votes: votesInCall.length,
        expected: talks.length * activeIds.size,
        completionPercent:
          talks.length === 0 || activeIds.size === 0
            ? 0
            : Math.round(
                (votesInCall.length / (talks.length * activeIds.size)) * 100,
              ),
      },
      progressByEvaluator,
      ranking,
      criteriaAverages,
      byTrack: this.distribute(talks, 'track', 'Sem trilha'),
      byLevel: this.distribute(talks, 'level', 'Não informado'),
    };
  }

  async report(callId: string, actor: JwtPayload): Promise<C4pReport> {
    const call = await this.calls.getManage(callId, actor);
    const { talks, votes } = await this.loadCallData(callId);

    const designations = await this.designationsRepo.find({
      where: {
        targetType: 'c4p_campaign',
        targetId: callId,
        designation: 'evaluator',
      },
    });
    const members = designations.length
      ? await this.membersRepo.findBy({
          id: In(designations.map((d) => d.memberId)),
        })
      : [];
    const memberById = new Map(members.map((member) => [member.id, member]));

    return {
      call: {
        id: call.id,
        slug: call.slug,
        name: call.name,
        description: call.description,
        finalizedAt: call.finalizedAt,
      },
      criteria: call.criteria,
      selectedTalkIds: call.selectedTalkIds ?? [],
      ranking: this.buildRanking(call, talks, votes),
      votes: votes
        .filter((vote) => talks.some((talk) => talk.id === vote.talkId))
        .map((vote) => {
          const designation = designations.find(
            (d) => d.id === vote.evaluatorDesignationId,
          );
          const member = designation
            ? memberById.get(designation.memberId)
            : undefined;
          return {
            talkId: vote.talkId,
            evaluatorName: member?.name ?? 'Avaliador removido',
            scores: vote.scores,
            comment: vote.comment,
            updatedAt: vote.updatedAt,
          };
        }),
    };
  }

  async getSnapshot(): Promise<C4pSnapshotPayload> {
    const calls = await this.callsRepo.find({
      where: [{ status: 'open' }, { status: 'closed', publicResults: true }],
      order: { createdAt: 'ASC' },
    });

    const communityIds = [
      ...new Set(
        calls.map((call) => call.communityId).filter((id): id is string => !!id),
      ),
    ];
    const eventIds = [
      ...new Set(
        calls
          .map((call) => call.managedEventId)
          .filter((id): id is string => !!id),
      ),
    ];
    const [communities, events] = await Promise.all([
      communityIds.length
        ? this.communitiesRepo.findBy({ id: In(communityIds) })
        : Promise.resolve([] as Community[]),
      eventIds.length
        ? this.eventsRepo.findBy({ id: In(eventIds) })
        : Promise.resolve([] as ManagedEvent[]),
    ]);
    const communityById = new Map(communities.map((c) => [c.id, c]));
    const eventById = new Map(events.map((e) => [e.id, e]));

    const callsWithResults = calls.filter(
      (call) => call.status === 'closed' && call.publicResults,
    );
    const selectedIds = [
      ...new Set(callsWithResults.flatMap((call) => call.selectedTalkIds ?? [])),
    ];
    const selectedTalks = selectedIds.length
      ? await this.talksRepo.findBy({ id: In(selectedIds) })
      : [];
    const talksById = new Map(selectedTalks.map((talk) => [talk.id, talk]));

    return {
      generatedAt: new Date().toISOString(),
      calls: calls.map((call) => {
        const community = call.communityId
          ? communityById.get(call.communityId)
          : undefined;
        const event = call.managedEventId
          ? eventById.get(call.managedEventId)
          : undefined;
        const results =
          call.status === 'closed' && call.publicResults
            ? {
                talks: (call.selectedTalkIds ?? [])
                  .map((talkId) => talksById.get(talkId))
                  .filter((talk): talk is C4pTalk => !!talk)
                  .map((talk) => ({
                    title: talk.title,
                    speakerName: talk.speakerName,
                    track: talk.track,
                    level: talk.level,
                  })),
              }
            : null;
        return {
          slug: call.slug,
          name: call.name,
          description: call.description,
          status: call.status,
          submissionOpenAt: call.submissionOpenAt,
          submissionCloseAt: call.submissionCloseAt,
          publicResults: call.publicResults,
          finalizedAt: call.finalizedAt,
          community: community
            ? { slug: community.slug, name: community.name }
            : null,
          event: event ? { slug: event.slug, title: event.title } : null,
          results,
        };
      }),
    };
  }

  private async loadCallData(callId: string): Promise<{
    talks: C4pTalk[];
    votes: C4pVote[];
    activeDesignations: MemberDesignation[];
  }> {
    const talks = await this.talksRepo.find({
      where: { callId },
      order: { createdAt: 'ASC' },
    });
    const talkIds = talks.map((talk) => talk.id);
    const votes = talkIds.length
      ? await this.votesRepo.find({ where: { talkId: In(talkIds) } })
      : [];
    const designations = await this.designationsRepo.find({
      where: {
        targetType: 'c4p_campaign',
        targetId: callId,
        designation: 'evaluator',
      },
    });
    return {
      talks,
      votes,
      activeDesignations: designations.filter((d) => d.status === 'active'),
    };
  }

  private async buildProgress(
    activeDesignations: MemberDesignation[],
    votes: C4pVote[],
    totalTalks: number,
  ): Promise<C4pDashboard['progressByEvaluator']> {
    const members = activeDesignations.length
      ? await this.membersRepo.findBy({
          id: In(activeDesignations.map((d) => d.memberId)),
        })
      : [];
    const memberById = new Map(members.map((member) => [member.id, member]));
    return activeDesignations.map((designation) => {
      const member = memberById.get(designation.memberId);
      const done = new Set(
        votes
          .filter((vote) => vote.evaluatorDesignationId === designation.id)
          .map((vote) => vote.talkId),
      ).size;
      return {
        designationId: designation.id,
        member: {
          name: member?.name ?? 'Membro removido',
          handle: member?.githubHandle ?? '—',
        },
        done,
        total: totalTalks,
        complete: totalTalks > 0 && done === totalTalks,
      };
    });
  }

  private buildRanking(
    call: C4pCall,
    talks: C4pTalk[],
    votes: C4pVote[],
  ): C4pDashboard['ranking'] {
    const votesByTalk = new Map<string, C4pVote[]>();
    for (const vote of votes) {
      const list = votesByTalk.get(vote.talkId) ?? [];
      list.push(vote);
      votesByTalk.set(vote.talkId, list);
    }
    return rankTalks(
      talks,
      (talk) =>
        computeTalkScore(votesByTalk.get(talk.id) ?? [], call.criteria),
      call.selectedTalkIds ?? [],
    ).map((ranked) => ({
      talkId: ranked.item.id,
      position: ranked.position,
      title: ranked.item.title,
      speakerName: ranked.item.speakerName,
      track: ranked.item.track,
      level: ranked.item.level,
      avgTotal: ranked.score.avgTotal,
      votesCount: ranked.score.votesCount,
      avgCriteria: ranked.score.avgCriteria,
      selected: ranked.selected,
    }));
  }

  private buildCriteriaAverages(
    criteria: Criterion[],
    ranking: C4pDashboard['ranking'],
  ): C4pDashboard['criteriaAverages'] {
    return criteria
      .map((criterion) => {
        const averages = ranking
          .map((row) => row.avgCriteria[criterion.key])
          .filter((avg): avg is number => avg !== undefined);
        if (averages.length === 0) return null;
        return {
          key: criterion.key,
          label: criterion.label,
          average:
            averages.reduce((sum, avg) => sum + avg, 0) / averages.length,
        };
      })
      .filter((row): row is C4pDashboard['criteriaAverages'][number] => row !== null);
  }

  private distribute(
    talks: C4pTalk[],
    field: 'track' | 'level',
    fallback: string,
  ): Array<{ value: string; count: number }> {
    const counts = new Map<string, number>();
    for (const talk of talks) {
      const value = talk[field]?.trim() || fallback;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  }
}
