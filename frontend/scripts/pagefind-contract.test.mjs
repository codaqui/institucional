import assert from 'node:assert/strict';
import { it } from 'vitest';
import {
  shouldExcludeFromSearch,
  shouldRunPagefind,
} from '../src/lib/pagefind-contract.ts';
import { shouldHandleSearchShortcut } from '../src/lib/search-shortcut.ts';

it('Pagefind runs only for the codaqui portal, never for tenants', () => {
  assert.equal(shouldRunPagefind(undefined), true);
  assert.equal(shouldRunPagefind(''), true);
  assert.equal(shouldRunPagefind('tisocial'), false);
  assert.equal(shouldRunPagefind('devparana'), false);
});

it('app routes are excluded from search while public content stays indexed', () => {
  for (const path of [
    '/admin/eventos',
    '/membro',
    '/auth/callback',
    '/eventos/detalhe',
    '/eventos/comprovante',
    '/pagefind/pagefind-ui.js',
    '/_astro/client.js',
  ]) {
    assert.equal(shouldExcludeFromSearch(path), true, path);
  }
  for (const path of ['/blog/post', '/trilhas/python', '/sobre/privacidade', '/comunidades']) {
    assert.equal(shouldExcludeFromSearch(path), false, path);
  }
});

it('search shortcut only fires outside editable controls and without modifiers', () => {
  assert.equal(shouldHandleSearchShortcut({ key: '/', target: { tagName: 'BODY' } }), true);
  assert.equal(shouldHandleSearchShortcut({ key: '/', target: { tagName: 'INPUT' } }), false);
  assert.equal(shouldHandleSearchShortcut({ key: '/', target: { tagName: 'TEXTAREA' } }), false);
  assert.equal(shouldHandleSearchShortcut({ key: '/', target: { tagName: 'SELECT' } }), false);
  assert.equal(shouldHandleSearchShortcut({ key: '/', target: { tagName: 'DIV', isContentEditable: true } }), false);
  assert.equal(shouldHandleSearchShortcut({ key: '/', target: { tagName: 'BODY' }, ctrlKey: true }), false);
  assert.equal(shouldHandleSearchShortcut({ key: '/', target: { tagName: 'BODY' }, metaKey: true }), false);
  assert.equal(shouldHandleSearchShortcut({ key: '/', target: { tagName: 'BODY' }, altKey: true }), false);
  assert.equal(shouldHandleSearchShortcut({ key: 'a', target: { tagName: 'BODY' } }), false);
});
