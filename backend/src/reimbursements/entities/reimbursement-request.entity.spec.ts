import { getMetadataArgsStorage } from 'typeorm';
import { ReimbursementRequest } from './reimbursement-request.entity';

describe('ReimbursementRequest entity — amount', () => {
  const amountColumn = getMetadataArgsStorage().columns.find(
    (column) =>
      column.target === ReimbursementRequest &&
      column.propertyName === 'amount',
  );

  it('persists em numeric(10,2) para preservar centavos', () => {
    expect(amountColumn?.options.type).toBe('numeric');
    expect(amountColumn?.options.precision).toBe(10);
    expect(amountColumn?.options.scale).toBe(2);
  });

  it('converte o valor vindo do banco (string) de volta para number', () => {
    const transformer = amountColumn?.options.transformer as
      | { to: (value: unknown) => unknown; from: (value: unknown) => unknown }
      | undefined;
    expect(transformer).toBeDefined();
    expect(transformer?.from?.('1234.56')).toBe(1234.56);
    expect(transformer?.from?.('0.01')).toBe(0.01);
  });

  it('não trunca nem arredonda o valor ao persistir', () => {
    const transformer = amountColumn?.options.transformer as
      | { to: (value: unknown) => unknown }
      | undefined;
    expect(transformer?.to?.(0.01)).toBe(0.01);
    expect(transformer?.to?.(10.5)).toBe(10.5);
    expect(transformer?.to?.(1234.56)).toBe(1234.56);
  });
});
