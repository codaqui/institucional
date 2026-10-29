import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResultDto } from '../../ledger/dto/paginated-result.dto';
import { Member } from '../entities/member.entity';

export class PaginatedMembersResultDto extends PaginatedResultDto<Member> {
  @ApiProperty({
    type: () => [Member],
    description: 'Lista de membros da página atual',
  })
  declare data: Member[];
}
