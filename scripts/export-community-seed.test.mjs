import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { communities } from '../frontend/src/data/communities.ts';

const seedUrl = new URL('../backend/src/communities/seed/communities.json', import.meta.url);

test('preserves all six historical communities and their public data', async () => {
  const seed = JSON.parse(await readFile(seedUrl, 'utf8'));

  assert.equal(seed.length, 6);
  assert.deepEqual(
    seed.map((community) => community.slug),
    ['devparana', 'elasnocodigo', 'campostechpg', 'tisocial', 'cloudnativemaringa', 'cumbucadev'],
  );

  for (const source of communities) {
    const exported = seed.find((community) => community.slug === source.id);
    assert.ok(exported, `missing ${source.id}`);
    assert.equal(exported.name, source.name);
    assert.equal(exported.description, source.description);
    assert.equal(exported.emoji, source.emoji);
    assert.equal(exported.logoUrl, source.logo);
    assert.equal(exported.location, source.location ?? null);
    assert.equal(exported.founded, source.founded ?? null);
    assert.deepEqual(exported.links, source.links);
    assert.deepEqual(exported.socialProfiles, source.socialProfiles ?? []);
    assert.deepEqual(exported.tags, source.tags);
    assert.equal(exported.status, 'active');
    assert.equal(exported.sealStatus, 'none');
  }
});

test('marks four integrated communities and preserves tenant enablement', async () => {
  const seed = JSON.parse(await readFile(seedUrl, 'utf8'));
  const integrated = seed.filter((community) => community.level === 'integrada');
  const partners = seed.filter((community) => community.level === 'parceira');

  assert.deepEqual(
    integrated.map((community) => community.slug),
    ['devparana', 'elasnocodigo', 'campostechpg', 'tisocial'],
  );
  assert.deepEqual(
    partners.map((community) => community.slug),
    ['cloudnativemaringa', 'cumbucadev'],
  );
  assert.deepEqual(
    seed.filter((community) => community.siteEnabled).map((community) => community.slug),
    ['devparana', 'elasnocodigo', 'tisocial'],
  );

  const camposTech = seed.find((community) => community.slug === 'campostechpg');
  assert.equal(camposTech.level, 'integrada');
  assert.equal(camposTech.siteEnabled, false);
  assert.equal(camposTech.siteDomain, null);
  assert.equal(seed.find((community) => community.slug === 'devparana').siteDomain, 'devparana.org');
  assert.equal(seed.find((community) => community.slug === 'elasnocodigo').siteDomain, 'elasnocodigo.com.br');
  assert.equal(seed.find((community) => community.slug === 'tisocial').siteDomain, 'tisocial.org.br');
});

test('does not introduce future community fields', async () => {
  const seed = JSON.parse(await readFile(seedUrl, 'utf8'));
  const forbidden = /^(responsibleMemberId|maintainer|payout|platformFeePct|isActive)/;

  for (const community of seed) {
    assert.deepEqual(Object.keys(community).filter((key) => forbidden.test(key)), []);
  }
});
