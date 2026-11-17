import { BadRequestException } from '@nestjs/common';

export function validateCompanyProfileUrls(values: {
  logoUrl?: string;
  websiteUrl?: string;
}): void {
  for (const field of ['logoUrl', 'websiteUrl'] as const) {
    const value = values[field];
    if (value === undefined) continue;
    try {
      if (new URL(value).protocol !== 'https:') throw new Error('not https');
    } catch {
      throw new BadRequestException(`${field} deve ser uma URL HTTPS válida.`);
    }
  }
}
