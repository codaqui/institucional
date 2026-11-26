import { assertCanonicalUrl } from './project-category';
import { CATALOG_SEED } from './catalog-seed';

describe('catalog seed', () => {
  it('contains the 23 current entries with unique slugs', () => {
    expect(CATALOG_SEED).toHaveLength(23);
    expect(new Set(CATALOG_SEED.map((entry) => entry.slug)).size).toBe(23);
    expect(CATALOG_SEED.filter((entry) => entry.category === 'open_source')).toHaveLength(11);
    expect(CATALOG_SEED.filter((entry) => entry.category === 'program')).toHaveLength(2);
    expect(CATALOG_SEED.filter((entry) => entry.category === 'campaign')).toHaveLength(10);
  });

  it('uses canonical destinations and valid public states', () => {
    for (const entry of CATALOG_SEED) {
      expect(() => assertCanonicalUrl(entry.canonicalUrl)).not.toThrow();
      expect(['active', 'finished']).toContain(entry.status);
      expect(entry.summary.trim().length).toBeGreaterThan(0);
    }
    expect(CATALOG_SEED.filter((entry) => entry.category === 'campaign').every((entry) => entry.status === 'finished' && entry.entitySlug === 'tisocial')).toBe(true);
  });

  it('keeps the canonical program destinations', () => {
    expect(CATALOG_SEED.find((entry) => entry.slug === 'codaqui-universitario')).toMatchObject({
      category: 'program',
      canonicalUrl: '/universitario',
      entitySlug: 'codaqui',
    });
    expect(CATALOG_SEED.find((entry) => entry.slug === 'embaixadores-devparana')).toMatchObject({
      category: 'program',
      canonicalUrl: 'https://devparana.org/embaixadores',
      entitySlug: 'devparana',
    });
  });
});
