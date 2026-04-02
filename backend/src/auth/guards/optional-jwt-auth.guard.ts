import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard de JWT opcional — não lança erro se não houver token.
 * Útil para endpoints que têm comportamento diferente para usuários autenticados
 * mas que também aceitam requisições anônimas (ex: checkout até R$ 100).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(_err: any, user: any) {
    return user ?? null; // nunca lança, apenas retorna null se não autenticado
  }
}
