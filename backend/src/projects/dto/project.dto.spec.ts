import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProjectDto } from './project.dto';

describe('CreateProjectDto', () => {
  it('accepts every informed value in a partial draft', async () => {
    const dto = plainToInstance(CreateProjectDto, {
      name: 'Rascunho parcial',
      entityId: '2a4a38de-eacf-49f1-a67f-a8162ec0f631',
      status: 'draft',
      schedule: [{ numero: 1, descricao: 'Encontro' }],
      budget: {
        itens: [{ descricao: 'Material', valorUnitario: 10.5 }],
        totalGeral: 0,
      },
      supportPartners: [{ cnpj: '12.345.678/0001-90' }],
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });
});
