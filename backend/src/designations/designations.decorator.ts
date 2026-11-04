import { SetMetadata } from '@nestjs/common';
import {
  Designation,
  TargetType,
} from './entities/member-designation.entity';

export const DESIGNATIONS_KEY = 'designations';

export interface DesignationRequirement {
  targetType: TargetType;
  targetIdParam: string;
  designation: Designation;
}

export const Designations = (requirement: DesignationRequirement) =>
  SetMetadata(DESIGNATIONS_KEY, requirement);
