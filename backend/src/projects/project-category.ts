import { BadRequestException } from '@nestjs/common';

export type ProjectCategory = 'program' | 'extension' | 'campaign' | 'open_source';

interface ProjectCategoryState {
  category?: ProjectCategory | null;
  status?: string;
  isPublic?: boolean;
}

export function isPublicCatalogProject(project: ProjectCategoryState): boolean {
  if (project.isPublic !== true) return false;
  const category = project.category ?? 'extension';
  if (category === 'extension') return project.status === 'active';
  return project.status === 'active' || project.status === 'finished';
}

export function assertExtensionCategory(
  project: Pick<ProjectCategoryState, 'category'>,
  message = 'Esta operação está disponível somente em projetos de extensão.',
): void {
  if ((project.category ?? 'extension') !== 'extension') {
    throw new BadRequestException(message);
  }
}

export function assertCanonicalUrl(value?: string | null): void {
  if (value === null || value === undefined) return;
  const trimmed = value.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return;
  try {
    if (new URL(trimmed).protocol === 'https:') return;
  } catch {
    // A validação abaixo produz o erro público.
  }
  throw new BadRequestException('A URL canônica deve ser um caminho interno ou HTTPS.');
}
