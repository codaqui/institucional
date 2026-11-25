import { BadRequestException } from '@nestjs/common';
import {
  assertCanonicalUrl,
  assertExtensionCategory,
  isPublicCatalogProject,
} from './project-category';

describe('project category contracts', () => {
  it('keeps only active extension projects public', () => {
    expect(isPublicCatalogProject({ category: 'extension', status: 'active', isPublic: true })).toBe(true);
    expect(isPublicCatalogProject({ category: 'extension', status: 'finished', isPublic: true })).toBe(false);
    expect(isPublicCatalogProject({ category: 'extension', status: 'active', isPublic: false })).toBe(false);
  });

  it.each(['program', 'campaign', 'open_source'])(
    'allows active and finished %s entries to be public',
    (category) => {
      expect(isPublicCatalogProject({ category, status: 'active', isPublic: true })).toBe(true);
      expect(isPublicCatalogProject({ category, status: 'finished', isPublic: true })).toBe(true);
      expect(isPublicCatalogProject({ category, status: 'draft', isPublic: true })).toBe(false);
    },
  );

  it('treats legacy entries without category as extension', () => {
    expect(() => assertExtensionCategory({ status: 'active' })).not.toThrow();
    expect(() => assertExtensionCategory({ category: 'campaign' })).toThrow(BadRequestException);
  });

  it('accepts internal paths and HTTPS canonical URLs', () => {
    expect(() => assertCanonicalUrl('/universitario')).not.toThrow();
    expect(() => assertCanonicalUrl('https://devparana.org/embaixadores')).not.toThrow();
    expect(() => assertCanonicalUrl(null)).not.toThrow();
    expect(() => assertCanonicalUrl(undefined)).not.toThrow();
  });

  it.each(['javascript:alert(1)', 'http://example.com', 'not-a-url', ''])(
    'rejects unsafe canonical URL %s',
    (value) => {
      expect(() => assertCanonicalUrl(value)).toThrow(BadRequestException);
    },
  );
});
