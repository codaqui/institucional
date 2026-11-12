import { SetMetadata } from '@nestjs/common';

export const TURNSTILE_ACTION_KEY = 'turnstileAction';

/**
 * Declara a ação Turnstile esperada na rota (ex.: 'c4p_submission').
 * Sem o decorator, o guard usa a ação padrão 'guest_claim'.
 */
export const TurnstileAction = (action: string) =>
  SetMetadata(TURNSTILE_ACTION_KEY, action);
