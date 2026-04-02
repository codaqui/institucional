import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

const { npm_package_version } = process.env;

@ApiTags('Status')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({
    summary: 'Health check / ping',
    description: 'Retorna o status da API e a versão atual do serviço.',
  })
  @ApiResponse({
    status: 200,
    description: 'Serviço operacional.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        version: { type: 'string', example: '0.0.1' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  ping() {
    return {
      status: 'ok',
      version: npm_package_version ?? '0.0.1',
      timestamp: new Date().toISOString(),
    };
  }
}
