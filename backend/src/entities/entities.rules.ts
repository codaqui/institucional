import { BadRequestException } from '@nestjs/common';
import { slugify } from '../common/slug';

export function entitySlug(value: string): string {
  const slug = slugify(
    value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(),
  );
  if (!slug) throw new BadRequestException('O nome da entidade deve gerar um slug válido.');
  return slug.slice(0, 80);
}

export function assertPartnershipDates({ startedAt, endsAt }: { startedAt: string; endsAt?: string | null }): void {
  if (endsAt && Date.parse(endsAt) <= Date.parse(startedAt)) {
    throw new BadRequestException('O encerramento da parceria deve ser posterior ao início.');
  }
}
