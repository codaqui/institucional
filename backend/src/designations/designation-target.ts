import type {
  Designation,
  TargetType,
} from './entities/member-designation.entity';

interface DesignationTarget {
  targetType: TargetType;
  targetId?: string | null;
  targetKey?: string | null;
  designation: Designation;
}

const TARGET_DESIGNATIONS: Record<TargetType, readonly Designation[]> = {
  community: ['responsible'],
  event: ['organizer'],
  ies: ['ambassador'],
  c4p_campaign: ['evaluator'],
  extension_project: ['mentor'],
  directorate: ['director', 'volunteer'],
  company: ['responsible'],
  entity: ['responsible', 'manager'],
  program: ['mentor', 'manager', 'founder'],
};

const PROGRAM_KEYS: Partial<Record<Designation, string>> = {
  mentor: 'mentoria',
  manager: 'universitario',
  founder: 'communities',
};

export function designationTargetError(
  input: DesignationTarget,
): string | null {
  if (!TARGET_DESIGNATIONS[input.targetType]?.includes(input.designation)) {
    return 'A designation informada não é válida para este tipo de destino.';
  }

  const hasTargetId = !!input.targetId;
  const hasTargetKey = !!input.targetKey;
  if (hasTargetId && hasTargetKey) {
    return 'Use targetId ou targetKey, não ambos.';
  }

  if (input.targetType === 'program') {
    if (!hasTargetKey || input.targetKey !== PROGRAM_KEYS[input.designation]) {
      return 'A designation de programa exige o targetKey correspondente.';
    }
    return null;
  }

  if (input.targetType === 'event') {
    return hasTargetId || hasTargetKey
      ? null
      : 'A designation de evento exige targetId ou targetKey.';
  }

  return hasTargetId
    ? null
    : 'A designation informada exige um targetId.';
}
