import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (name) => readFileSync(new URL(`../docs/mockups/${name}`, import.meta.url), 'utf8');
const main = read('main-proposta.html');
const home = read('home-jornadas.html');
const admin = read('admin-proposta.html');
const community = read('comunidade-transparencia-proposta.html');
const member = read('membro-proposta.html');
const profile = read('perfil-proposta.html');
const shared = read('shared.css');

test('mockups use native landmarks and decorative media semantics', () => {
  for (const html of [main, home, profile]) {
    assert.doesNotMatch(html, /<(?:div|span)[^>]*role="img"/);
  }
  for (const html of [main, home]) {
    assert.match(html, /<section class="announcement" aria-label="Anúncios institucionais">/);
    assert.match(html, /aria-label="◐ Tema: alternar entre modo claro e escuro"/);
  }
});

test('home stats selectors are defined only once', () => {
  for (const selector of ['.stats', '.stats ul', '.stats strong', '[data-theme="dark"] .stats strong', '.stats span']) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const declarations = home.match(new RegExp(`^\\s*${escaped}\\s*\\{`, 'gm')) ?? [];
    assert.equal(declarations.length, 1, `${selector} must have one declaration block`);
  }
});

test('translucent hero buttons use dark backgrounds behind white text', () => {
  assert.match(shared, /\.hero \.btn-ghost-light \{ background: rgb\(0 0 0 \/ 0\.14\)/);
  assert.match(home, /background: rgb\(0 0 0 \/ 0\.14\); border: 1px solid rgb\(255 255 255 \/ 0\.45\)/);
});

test('admin and community mockups avoid specificity shortcuts and use Sets', () => {
  assert.doesNotMatch(admin, /!important/);
  assert.doesNotMatch(community, /!important/);
  assert.doesNotMatch(community, /<!--[^>]*\btodo\b/i);
  assert.match(admin, /const roles = new Set\(el\.dataset\.roles\.split\(" "\)\)/);
  assert.match(admin, /roles\.has\("\*"\)/);
});

test('member keyboard handlers use explicit conditional blocks', () => {
  assert.doesNotMatch(member, /if\(e\.key==='ArrowRight'\)select/);
  assert.doesNotMatch(member, /if\(e\.key==='ArrowLeft'\)select/);
  assert.doesNotMatch(member, /if\(!b\)return/);
});
