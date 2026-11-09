import { parseCsvText } from './csv';

describe('CSV participant presence and certificate flags', () => {
  it('parses boolean presence and certificate columns', () => {
    expect(parseCsvText('name,email,checkin,certificate\nAna,ana@x.dev,true,false')[0])
      .toMatchObject({ checkin: true, certificate: false });
  });

  it('defaults absent or empty flags to undefined', () => {
    expect(parseCsvText('name,email,checkin,certificate\nAna,ana@x.dev,,')[0])
      .toMatchObject({ checkin: undefined, certificate: undefined });
  });

  it('accepts common boolean values without treating false as true', () => {
    expect(parseCsvText('name,email,checkin,certificate\nAna,ana@x.dev,false,true')[0])
      .toMatchObject({ checkin: false, certificate: true });
    expect(parseCsvText('name,email,checkin,certificate\nAna,ana@x.dev,0,1')[0])
      .toMatchObject({ checkin: false, certificate: true });
  });
});
