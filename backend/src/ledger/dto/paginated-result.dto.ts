import { ApiProperty } from '@nestjs/swagger';

export class PaginatedResultDto<T> {
  @ApiProperty({ description: 'Lista de itens da página atual' })
  data: T[];

  @ApiProperty({ description: 'Total de registros disponíveis', example: 42 })
  total: number;

  @ApiProperty({ description: 'Página atual (1-indexed)', example: 1 })
  page: number;

  @ApiProperty({ description: 'Itens por página', example: 10 })
  limit: number;

  @ApiProperty({ description: 'Total de páginas', example: 5 })
  totalPages: number;
}
