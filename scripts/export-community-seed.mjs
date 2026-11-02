import { mkdir, writeFile } from 'node:fs/promises';
import { communities } from '../frontend/src/data/communities.ts';

const integrated = new Set(['devparana', 'elasnocodigo', 'tisocial', 'campostechpg']);
const enabledTenants = new Set(['devparana', 'elasnocodigo', 'tisocial']);
const domains = {
  devparana: 'devparana.org',
  elasnocodigo: 'elasnocodigo.com.br',
  tisocial: 'tisocial.org.br',
};

const seed = communities.map((community) => ({
  slug: community.id,
  name: community.name,
  description: community.description,
  emoji: community.emoji,
  logoUrl: community.logo,
  location: community.location ?? null,
  founded: community.founded ?? null,
  links: community.links,
  socialProfiles: community.socialProfiles ?? [],
  tags: community.tags,
  level: integrated.has(community.id) ? 'integrada' : 'parceira',
  status: 'active',
  sealStatus: 'none',
  siteEnabled: enabledTenants.has(community.id),
  siteDomain: domains[community.id] ?? null,
}));

const output = new URL('../backend/src/communities/seed/communities.json', import.meta.url);
await mkdir(new URL('.', output), { recursive: true });
await writeFile(output, `${JSON.stringify(seed, null, 2)}\n`);
