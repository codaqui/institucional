import { toCsv } from './csv';

describe('toCsv', () => {
  it('escapes formulas and preserves Excel-compatible CSV', () => {
    const csv = toCsv(
      ['description'],
      [{ description: '=HYPERLINK("https://evil.example")' }],
    );

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('\r\n');
  });

  it.each(['+SUM(1,1)', '-2+3', '@cmd', '\t=1+1', '\r=1+1'])(
    'neutralizes the formula prefix %j',
    (value) => {
      expect(toCsv(['description'], [{ description: value }])).toContain(
        `"'${value.replaceAll('"', '""')}"`,
      );
    },
  );

  it('quotes delimiters, double quotes and line breaks', () => {
    expect(
      toCsv(['description', 'amount'], [
        { description: 'Doação, "mensal"\n2ª linha', amount: 12.5 },
      ]),
    ).toBe(
      '\ufeff"description","amount"\r\n"Doação, ""mensal""\n2ª linha","12.5"',
    );
  });
});
