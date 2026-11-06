import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import {
  Assembly,
  AssemblyNotaryRegistry,
  AssemblyStatus,
  AssemblyType,
} from './entities/assembly.entity';

export interface AssemblyActor {
  roles?: string[];
}

export const ASSEMBLY_DISCUSSION_URL_PATTERN =
  /^https:\/\/github\.com\/codaqui\/institucional\/discussions\/[1-9]\d*$/;

const storageService = new StorageService();

export function assemblySlug(type: AssemblyType, number: number): string {
  if (!['ordinaria', 'oficial'].includes(type)) {
    throw new BadRequestException('tipo inválido para assembleia');
  }
  if (!Number.isInteger(number) || number < 1) {
    throw new BadRequestException(
      'número inteiro positivo é obrigatório para assembleia',
    );
  }
  return `${type}-${number}`;
}

export function parseDiscussionUrl(value: string): string {
  if (
    typeof value !== 'string' ||
    !ASSEMBLY_DISCUSSION_URL_PATTERN.test(value)
  ) {
    throw new BadRequestException(
      'Discussion inválida: use https://github.com/codaqui/institucional/discussions/<número>',
    );
  }
  return value;
}

function hasCompleteNotaryRegistry(
  registry: AssemblyNotaryRegistry | null | undefined,
): registry is AssemblyNotaryRegistry {
  if (!registry) return false;
  const hasRegistrationDate =
    registry.registeredAt instanceof Date ||
    (typeof registry.registeredAt === 'string' &&
      registry.registeredAt.trim().length > 0);
  const registeredAt = new Date(registry.registeredAt);
  return (
    typeof registry.book === 'string' &&
    registry.book.trim().length > 0 &&
    typeof registry.page === 'string' &&
    registry.page.trim().length > 0 &&
    hasRegistrationDate &&
    !Number.isNaN(registeredAt.getTime())
  );
}

export function assertAssemblyTransition(
  assembly: Assembly,
  patch: Partial<Assembly>,
  actor: AssemblyActor,
): void {
  for (const field of ['type', 'number', 'discussionUrl'] as const) {
    if (patch[field] !== undefined && patch[field] !== assembly[field]) {
      throw new BadRequestException(`${field} é imutável`);
    }
  }

  const nextStatus: AssemblyStatus = patch.status ?? assembly.status;
  if (
    patch.status !== undefined &&
    patch.status !== assembly.status &&
    (assembly.status !== 'scheduled' ||
      !['held', 'canceled'].includes(patch.status))
  ) {
    throw new BadRequestException(
      `Transição de status inválida: ${assembly.status} -> ${patch.status}`,
    );
  }

  const touchesNotaryData =
    patch.ataPdfUrl !== undefined || patch.notaryRegistry !== undefined;
  if (touchesNotaryData && !actor.roles?.includes('admin')) {
    throw new ForbiddenException('Dados de cartório somente admin');
  }

  const scheduledAt = patch.scheduledAt ?? assembly.scheduledAt;
  const heldAt = patch.heldAt === undefined ? assembly.heldAt : patch.heldAt;
  if (nextStatus === 'held' && !heldAt) {
    throw new BadRequestException(
      'heldAt é obrigatório para realizar assembleia',
    );
  }
  if (heldAt) {
    const heldTime = new Date(heldAt).getTime();
    const scheduledTime = new Date(scheduledAt).getTime();
    if (Number.isNaN(heldTime) || Number.isNaN(scheduledTime)) {
      throw new BadRequestException('Datas da assembleia inválidas');
    }
    if (heldTime < scheduledTime) {
      throw new BadRequestException(
        'heldAt não pode ser anterior a scheduledAt',
      );
    }
  }

  const ataPdfUrl =
    patch.ataPdfUrl === undefined ? assembly.ataPdfUrl : patch.ataPdfUrl;
  const notaryRegistry =
    patch.notaryRegistry === undefined
      ? assembly.notaryRegistry
      : patch.notaryRegistry;

  if (ataPdfUrl !== null && ataPdfUrl !== undefined) {
    try {
      storageService.validateReceiptUrl(ataPdfUrl);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'URL inválida para ata',
      );
    }
  }
  if (notaryRegistry && !hasCompleteNotaryRegistry(notaryRegistry)) {
    throw new BadRequestException(
      'Dados de cartório completo são obrigatórios',
    );
  }
  if (
    assembly.type === 'oficial' &&
    nextStatus === 'held' &&
    (!ataPdfUrl || !hasCompleteNotaryRegistry(notaryRegistry))
  ) {
    throw new BadRequestException(
      'Assembleia oficial realizada exige PDF e cartório completo',
    );
  }

  if (patch.discussionUrl !== undefined) {
    parseDiscussionUrl(patch.discussionUrl);
  }
}
