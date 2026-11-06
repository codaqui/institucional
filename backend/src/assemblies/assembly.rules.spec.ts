import { Assembly, AssemblyType } from './entities/assembly.entity';
import {
  AssemblyActor,
  assemblySlug,
  assertAssemblyTransition,
  parseDiscussionUrl,
} from './assembly.rules';

const scheduledAt = new Date('2026-11-10T18:00:00.000Z');
const heldAt = new Date('2026-11-10T20:00:00.000Z');
const validDiscussionUrl =
  'https://github.com/codaqui/institucional/discussions/42';
const validPdfUrl = 'https://drive.google.com/file/d/assembly-ata/view';
const validNotaryRegistry = {
  book: 'Livro 01',
  page: '42',
  registeredAt: '2026-11-11T12:00:00.000Z',
};

const admin: AssemblyActor = { roles: ['admin'] };
const director: AssemblyActor = { roles: ['diretor'] };

function makeAssembly(overrides: Partial<Assembly> = {}): Assembly {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    type: 'ordinaria',
    number: 1,
    title: 'Assembleia ordinária',
    scheduledAt,
    heldAt: null,
    status: 'scheduled',
    agendaSummary: 'Resumo curto da pauta.',
    discussionUrl: validDiscussionUrl,
    ataPdfUrl: null,
    notaryRegistry: null,
    createdById: '22222222-2222-2222-2222-222222222222',
    createdAt: new Date('2026-11-01T12:00:00.000Z'),
    updatedAt: new Date('2026-11-01T12:00:00.000Z'),
    ...overrides,
  };
}

describe('assemblySlug', () => {
  it('derives the stable slug from type and number', () => {
    expect(assemblySlug('ordinaria', 2)).toBe('ordinaria-2');
    expect(assemblySlug('oficial', 12)).toBe('oficial-12');
  });

  it.each([0, -1, 1.5, Number.NaN])(
    'rejects an invalid assembly number: %s',
    (number) => {
      expect(() => assemblySlug('ordinaria', number)).toThrow(
        'número inteiro positivo',
      );
    },
  );

  it('rejects an unknown assembly type', () => {
    expect(() => assemblySlug('extra' as AssemblyType, 1)).toThrow(
      'tipo inválido',
    );
  });
});

describe('parseDiscussionUrl', () => {
  it('accepts the exact public GitHub Discussion URL', () => {
    expect(parseDiscussionUrl(validDiscussionUrl)).toBe(validDiscussionUrl);
  });

  it.each([
    'http://github.com/codaqui/institucional/discussions/42',
    'https://github.com.evil.example/codaqui/institucional/discussions/42',
    'https://github.com/codaqui/outro/discussions/42',
    'https://github.com/codaqui/institucional/discussions/not-a-number',
    'https://github.com/codaqui/institucional/discussions/0',
    'https://github.com/codaqui/institucional/discussions/42/',
    'https://github.com/codaqui/institucional/discussions/42?tab=comments',
    'https://github.com/codaqui/institucional/discussions/42#comment',
    'not-a-url',
  ])('rejects a non-canonical Discussion URL: %s', (value) => {
    expect(() => parseDiscussionUrl(value)).toThrow('Discussion inválida');
  });
});

describe('assertAssemblyTransition', () => {
  it('allows an ordinary scheduled assembly to be held after its scheduled date', () => {
    expect(() =>
      assertAssemblyTransition(
        makeAssembly(),
        { status: 'held', heldAt },
        director,
      ),
    ).not.toThrow();
  });

  it('allows a scheduled assembly to be canceled without heldAt', () => {
    expect(() =>
      assertAssemblyTransition(
        makeAssembly(),
        { status: 'canceled' },
        director,
      ),
    ).not.toThrow();
  });

  it('requires heldAt when marking an assembly as held', () => {
    expect(() =>
      assertAssemblyTransition(makeAssembly(), { status: 'held' }, director),
    ).toThrow('heldAt é obrigatório');
  });

  it('rejects heldAt before scheduledAt', () => {
    expect(() =>
      assertAssemblyTransition(
        makeAssembly(),
        {
          status: 'held',
          heldAt: new Date('2026-11-10T17:59:59.999Z'),
        },
        director,
      ),
    ).toThrow('heldAt não pode ser anterior');
  });

  it('requires PDF and complete notary registry when an official assembly is held', () => {
    const official = makeAssembly({ type: 'oficial' });

    expect(() =>
      assertAssemblyTransition(official, { status: 'held', heldAt }, admin),
    ).toThrow('PDF e cartório');
  });

  it('accepts an official held assembly with PDF and complete notary registry', () => {
    const official = makeAssembly({ type: 'oficial' });

    expect(() =>
      assertAssemblyTransition(
        official,
        {
          status: 'held',
          heldAt,
          ataPdfUrl: validPdfUrl,
          notaryRegistry: validNotaryRegistry,
        },
        admin,
      ),
    ).not.toThrow();
  });

  it.each([
    ['held', 'canceled'],
    ['canceled', 'held'],
    ['canceled', 'scheduled'],
  ] as const)(
    'rejects a terminal status transition from %s to %s',
    (from, to) => {
      const assembly = makeAssembly({
        status: from,
        heldAt: from === 'held' ? heldAt : null,
      });

      expect(() =>
        assertAssemblyTransition(assembly, { status: to, heldAt }, admin),
      ).toThrow('Transição de status inválida');
    },
  );

  it('allows metadata edits without changing a terminal status', () => {
    const held = makeAssembly({ status: 'held', heldAt });

    expect(() =>
      assertAssemblyTransition(held, { title: 'Título corrigido' }, director),
    ).not.toThrow();
  });

  it.each(['type', 'number', 'discussionUrl'] as const)(
    'keeps %s immutable',
    (field) => {
      const changes = {
        type: { type: 'oficial' },
        number: { number: 2 },
        discussionUrl: {
          discussionUrl:
            'https://github.com/codaqui/institucional/discussions/43',
        },
      } as const;

      expect(() =>
        assertAssemblyTransition(makeAssembly(), changes[field], director),
      ).toThrow('imutável');
    },
  );

  it.each(['ataPdfUrl', 'notaryRegistry'] as const)(
    'restricts notary field %s to admin',
    (field) => {
      const changes = {
        ataPdfUrl: { ataPdfUrl: validPdfUrl },
        notaryRegistry: { notaryRegistry: validNotaryRegistry },
      } as const;

      expect(() =>
        assertAssemblyTransition(makeAssembly(), changes[field], director),
      ).toThrow('somente admin');
    },
  );

  it('lets an admin complete notary data after an ordinary assembly was held', () => {
    const held = makeAssembly({ status: 'held', heldAt });

    expect(() =>
      assertAssemblyTransition(
        held,
        {
          ataPdfUrl: validPdfUrl,
          notaryRegistry: validNotaryRegistry,
        },
        admin,
      ),
    ).not.toThrow();
  });

  it('reuses the storage allowlist for assembly PDF URLs', () => {
    expect(() =>
      assertAssemblyTransition(
        makeAssembly(),
        {
          ataPdfUrl: 'https://evil.example/ata.pdf',
        },
        admin,
      ),
    ).toThrow('Domínio não permitido');
  });

  it('rejects an empty PDF URL instead of treating it as absent', () => {
    expect(() =>
      assertAssemblyTransition(makeAssembly(), { ataPdfUrl: '' }, admin),
    ).toThrow('URL inválida');
  });

  it('rejects an incomplete notary registry', () => {
    expect(() =>
      assertAssemblyTransition(
        makeAssembly(),
        {
          notaryRegistry: { ...validNotaryRegistry, page: '  ' },
        },
        admin,
      ),
    ).toThrow('cartório completo');
  });

  it('rejects a null notary registration date', () => {
    expect(() =>
      assertAssemblyTransition(
        makeAssembly(),
        {
          notaryRegistry: {
            ...validNotaryRegistry,
            registeredAt: null as unknown as string,
          },
        },
        admin,
      ),
    ).toThrow('cartório completo');
  });
});
