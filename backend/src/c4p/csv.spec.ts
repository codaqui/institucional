import { CsvParseError, parseC4pCsv } from './csv';

const FULL_HEADER =
  'Carimbo de data/hora,Nome Completo,Email,WhatsApp (com DDD),Cargo e Empresa,LinkedIn,Já palestrou antes?,Título da Palestra,Resumo da Palestra,Nível,Tema/trilha,Bio curta,Foto,Algo mais que a curadoria deveria saber?';

describe('parseC4pCsv', () => {
  it('mapeia o header completo do Google Forms para todos os campos', () => {
    const csv = [
      FULL_HEADER,
      '2026/01/01 10:00:00,Maria Silva,maria@example.com,+55 44 99999-0000,Dev na ACME,https://linkedin.com/in/maria,Sim,Intro ao TypeScript,Uma palestra introdutória.,Iniciante,Frontend,"Maria é dev há 5 anos.",https://img.example.com/maria.jpg,Prefere palestrar de manhã',
    ].join('\n');
    const { rows, skipped } = parseC4pCsv(csv);
    expect(skipped).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      speakerName: 'Maria Silva',
      speakerEmail: 'maria@example.com',
      speakerPhone: '+55 44 99999-0000',
      speakerRole: 'Dev na ACME',
      linkedin: 'https://linkedin.com/in/maria',
      spokeBefore: true,
      title: 'Intro ao TypeScript',
      summary: 'Uma palestra introdutória.',
      level: 'Iniciante',
      track: 'Frontend',
      bio: 'Maria é dev há 5 anos.',
      photoUrl: 'https://img.example.com/maria.jpg',
      extraNotes: 'Prefere palestrar de manhã',
    });
  });

  it('aceita variantes de cabeçalho (Nome, E-mail, Trilha)', () => {
    const csv = [
      'Nome,E-mail,Trilha,Título',
      'João,joao@example.com,Backend,APIs com NestJS',
    ].join('\n');
    const { rows, skipped } = parseC4pCsv(csv);
    expect(skipped).toEqual([]);
    expect(rows[0].speakerName).toBe('João');
    expect(rows[0].speakerEmail).toBe('joao@example.com');
    expect(rows[0].track).toBe('Backend');
    expect(rows[0].title).toBe('APIs com NestJS');
  });

  it('marca linha sem título como skipped com número da linha', () => {
    const csv = ['Nome,Título', 'João,', ',Sem nome'].join('\n');
    const { rows, skipped } = parseC4pCsv(csv);
    expect(rows).toEqual([]);
    expect(skipped).toEqual([
      { line: 2, reason: 'Título ausente.' },
      { line: 3, reason: 'Nome do palestrante ausente.' },
    ]);
  });

  it('marca linha com e-mail inválido como skipped', () => {
    const csv = ['Nome,Email,Título', 'João,nao-e-email,Palestra X'].join('\n');
    const { rows, skipped } = parseC4pCsv(csv);
    expect(rows).toEqual([]);
    expect(skipped).toEqual([{ line: 2, reason: 'E-mail inválido.' }]);
  });

  it.each`
    raw         | expected
    ${'Sim'}    | ${true}
    ${'Não'}    | ${false}
    ${'talvez'} | ${null}
    ${''}       | ${null}
  `('spokeBefore "$raw" vira $expected', ({ raw, expected }) => {
    const csv = ['Nome,Título,Já palestrou antes?', `João,Palestra X,${raw}`].join(
      '\n',
    );
    expect(parseC4pCsv(csv).rows[0].spokeBefore).toBe(expected);
  });

  it('funciona com delimitador ";"', () => {
    const csv = ['Nome;Título;Resumo', 'João;Palestra X;Resumo da palestra'].join(
      '\n',
    );
    const { rows } = parseC4pCsv(csv);
    expect(rows[0].title).toBe('Palestra X');
    expect(rows[0].summary).toBe('Resumo da palestra');
  });

  it('lança CsvParseError ao exceder maxRows', () => {
    const lines = ['Nome,Título'];
    for (let i = 0; i < 3; i += 1) lines.push(`João ${i},Palestra ${i}`);
    expect(() => parseC4pCsv(lines.join('\n'), 2)).toThrow(CsvParseError);
  });

  it('lança CsvParseError em CSV vazio', () => {
    expect(() => parseC4pCsv('')).toThrow(CsvParseError);
  });

  it('ignora colunas desconhecidas sem erro', () => {
    const csv = ['Nome,Título,Coluna Extra,Outra', 'João,Palestra X,foo,bar'].join(
      '\n',
    );
    const { rows, skipped } = parseC4pCsv(csv);
    expect(skipped).toEqual([]);
    expect(rows[0].title).toBe('Palestra X');
    expect(rows[0]).not.toHaveProperty('colunaExtra');
  });
});
