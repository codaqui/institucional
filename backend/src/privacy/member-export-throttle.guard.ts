import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
} from '@nestjs/throttler';
import type { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';

@Injectable()
export class MemberExportThrottleGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    return this.handleRequest({
      context,
      limit: 3,
      ttl: 3_600_000,
      blockDuration: 3_600_000,
      throttler: { name: 'member-export', limit: 3, ttl: 3_600_000 },
      getTracker: async (req) => req.user?.sub ?? req.ip ?? 'unknown',
      generateKey: (_context, suffix, name) => `privacy-export:${name}:${suffix}`,
    });
  }
}
