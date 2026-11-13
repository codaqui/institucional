import { CsvParseError, tokenizeCsvRecords } from './csv-tokenizer';

describe('tokenizeCsvRecords', () => {
  it('detecta ";" como delimitador pelo header', () => {
    expect(tokenizeCsvRecords('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('suporta aspas com escape duplo e vírgula dentro do campo', () => {
    expect(tokenizeCsvRecords('a,b\n"x""y",z')).toEqual([
      ['a', 'b'],
      ['x"y', 'z'],
    ]);
  });
  it('trata \r\n como quebra única e remove BOM', () => {
    expect(tokenizeCsvRecords('\ufeffa,b\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
  it('ignora linhas totalmente vazias', () => {
    expect(tokenizeCsvRecords('a,b\n,\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
  it('rejeita entrada não-string com CsvParseError', () => {
    expect(() => tokenizeCsvRecords(123 as unknown as string)).toThrow(
      CsvParseError,
    );
  });
});
