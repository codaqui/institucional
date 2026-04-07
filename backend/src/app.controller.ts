import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { readFileSync } from 'fs';
import { join } from 'path';

// Lê a versão diretamente do package.json para funcionar tanto com
// `npm start` quanto com `node dist/main.js` (Docker sem npm).
const APP_VERSION = (() => {
  try {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
    ) as { version: string };
    return pkg.version;
  } catch {
    return '0.0.0';
  }
})();

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
        version: { type: 'string', example: '0.0.5' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  ping() {
    return {
      status: 'ok',
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
    };
  }
}
