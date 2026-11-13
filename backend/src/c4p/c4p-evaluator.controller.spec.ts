import { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { C4pEvaluatorsService } from './c4p-evaluators.service';
import { C4pEvaluatorController } from './c4p-evaluator.controller';
import { C4pVotesService } from './c4p-votes.service';

const currentUser = {
  sub: 'eval-1',
  githubId: 2,
  handle: 'evaluator',
  name: 'Evaluator',
  email: 'eval@example.com',
  avatarUrl: null,
  roles: ['membro'],
};

describe('C4pEvaluatorController', () => {
  let controller: C4pEvaluatorController;
  let evaluators: Record<string, jest.Mock>;
  let votes: Record<string, jest.Mock>;

  beforeEach(async () => {
    evaluators = {
      myEvaluations: jest.fn().mockResolvedValue([]),
      accept: jest.fn().mockResolvedValue({ id: 'des-1', status: 'active' }),
    };
    votes = {
      getEvaluatorCall: jest.fn().mockResolvedValue({}),
      listTalksForEvaluator: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({ id: 'vote-1' }),
    };
    const module = await Test.createTestingModule({
      controllers: [C4pEvaluatorController],
      providers: [
        { provide: C4pEvaluatorsService, useValue: evaluators },
        { provide: C4pVotesService, useValue: votes },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest().user = currentUser;
          return true;
        },
      })
      .compile();
    controller = module.get(C4pEvaluatorController);
  });

  it('GET calls lista as campanhas do avaliador', async () => {
    await controller.myCalls({ user: currentUser });
    expect(evaluators.myEvaluations).toHaveBeenCalledWith('eval-1');
  });

  it('POST designations/:id/accept repassa o actor', async () => {
    await controller.accept('des-1', { user: currentUser });
    expect(evaluators.accept).toHaveBeenCalledWith('des-1', currentUser);
  });

  it('PUT vote repassa callId, talkId, actor e dto', async () => {
    const dto = { scores: { relevancia: 8 } };
    await controller.upsertVote(
      'call-1',
      'talk-1',
      dto,
      { user: currentUser },
    );
    expect(votes.upsert).toHaveBeenCalledWith(
      'call-1',
      'talk-1',
      currentUser,
      dto,
    );
  });
});
