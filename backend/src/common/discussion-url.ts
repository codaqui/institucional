import { BadRequestException } from '@nestjs/common';

export const DISCUSSION_URL_PATTERN = /^https:\/\/github\.com\/codaqui\/institucional\/discussions\/[1-9]\d*$/;

export function assertDiscussionUrl(value: string): string {
  if (typeof value !== 'string' || !DISCUSSION_URL_PATTERN.test(value)) {
    throw new BadRequestException('Discussion inválida: use https://github.com/codaqui/institucional/discussions/<número>');
  }
  return value;
}
