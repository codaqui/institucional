import { BadRequestException } from '@nestjs/common';
import { slugify } from '../common/slug';

export interface ScheduleItem {
  numero: number;
  descricao: string;
  carga: number;
}

export interface BudgetItem {
  descricao: string;
  quantidade: number;
  unidadeMedida: string;
  valorUnitario: number;
  valorTotalItem: number;
}

export interface ProjectBudget {
  itens: BudgetItem[];
  totalGeral: number;
}

export interface ProjectDatesInput {
  startsAt: string;
  endsAt: string;
  registrationStartsAt: string;
  registrationEndsAt: string;
}

export const hoursToCents = (value: number): number => Math.round(value * 100);

export function normalizeProjectName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function projectSlug(name: string): string {
  const slug = slugify(normalizeProjectName(name));
  if (!slug) throw new BadRequestException('O nome do projeto deve gerar um slug válido.');
  return slug.slice(0, 160);
}

export function assertScheduleMatches(schedule: ScheduleItem[], totalHours: number): void {
  if (totalHours <= 0 || schedule.length === 0) {
    throw new BadRequestException('Informe ao menos um encontro com carga horária positiva.');
  }
  for (const item of schedule) {
    if (!item.descricao?.trim() || item.carga <= 0) {
      throw new BadRequestException('Cada encontro precisa de descrição e carga positiva.');
    }
  }
  const total = schedule.reduce((sum, item) => sum + hoursToCents(item.carga), 0);
  if (total !== hoursToCents(totalHours)) {
    throw new BadRequestException('A soma dos encontros deve ser igual à carga horária total.');
  }
}

export function assertProjectDates(input: ProjectDatesInput): void {
  const start = Date.parse(input.startsAt);
  const end = Date.parse(input.endsAt);
  const registrationStart = Date.parse(input.registrationStartsAt);
  const registrationEnd = Date.parse(input.registrationEndsAt);
  if (start >= end) throw new BadRequestException('O início do projeto deve ser anterior ao fim.');
  if (registrationStart >= registrationEnd) {
    throw new BadRequestException('A janela de inscrição deve ter início anterior ao fim.');
  }
  if (registrationEnd > start) {
    throw new BadRequestException('A janela de inscrição deve terminar antes do início da execução.');
  }
}

export function assertOds(primary: number, secondary: number[]): void {
  if (!Number.isInteger(primary) || primary < 1 || primary > 17) {
    throw new BadRequestException('A ODS principal deve estar entre 1 e 17.');
  }
  if (secondary.some((value) => !Number.isInteger(value) || value < 1 || value > 17)) {
    throw new BadRequestException('Todas as ODS secundárias devem estar entre 1 e 17.');
  }
  if (new Set(secondary).size !== secondary.length || secondary.includes(primary)) {
    throw new BadRequestException('ODS secundárias devem ser únicas e diferentes da principal.');
  }
}

export function assertBudget(budget: ProjectBudget): void {
  let total = 0;
  for (const item of budget.itens) {
    const expected = hoursToCents(item.quantidade * item.valorUnitario);
    if (hoursToCents(item.valorTotalItem) !== expected) {
      throw new BadRequestException('O valor total de cada item deve ser quantidade × valor unitário.');
    }
    total += expected;
  }
  if (hoursToCents(budget.totalGeral) !== total) {
    throw new BadRequestException('O total geral do orçamento deve ser a soma dos itens.');
  }
}

const REQUIRED_FIELDS = [
  'kind', 'summary', 'startsAt', 'endsAt', 'registrationStartsAt', 'registrationEndsAt',
  'odsPrimary', 'targetCommunity', 'justification', 'objective', 'skillsDeveloped',
  'methodology', 'totalHours', 'maxParticipants', 'mentorMemberId',
] as const;

export function assertProjectComplete(project: Record<string, any> & ProjectDatesInput & { schedule: ScheduleItem[]; totalHours: number; odsPrimary: number; odsSecondary?: number[] }): void {
  for (const field of REQUIRED_FIELDS) {
    const value = project[field];
    if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
      throw new BadRequestException(`O campo ${field} é obrigatório para completar o projeto.`);
    }
  }
  assertProjectDates(project);
  assertOds(project.odsPrimary, project.odsSecondary ?? []);
  assertScheduleMatches(project.schedule, project.totalHours);
  if (project.budget) assertBudget(project.budget);
}
