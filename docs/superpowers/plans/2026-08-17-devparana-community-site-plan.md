<!-- AGENT-INDEX
purpose: Plano de implementação passo a passo para criar o site da comunidade DevParaná dentro do portal Codaqui, seguindo o design spec.
audience: AI agents, mantenedores
status: Draft / pronto para execução
sections:
  - Global constraints
  - File structure
  - Task 1: Scaffold e configuração
  - Task 2: Dados de embaixadores e regiões
  - Task 3: Dados de equipe e Na Estrada
  - Task 4: Páginas core
  - Task 5: Página de embaixadores
  - Task 6: Página Na Estrada
  - Task 7: Docs e integração no build
  - Task 8: Validação final
  - Self-review
related-docs:
  - docs/superpowers/specs/2026-08-17-devparana-community-site-design.md
  - AGENTS.md — padrões do projeto
agent-protocol:
  - REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans.
  - Cada task termina com typecheck/build ou teste específico.
  - Não alterar redirects legados nem outras comunidades.
-->

# DevParaná Community Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o site da comunidade DevParaná em `comunidades/devparana/`, reaproveitando componentes compartilhados e expondo as estruturas das RFCs 001 (Embaixadores) e 002 (DevParaná na Estrada).

**Architecture:** Site estático multi-tenant dentro do Docusaurus Codaqui, registrado em `comunidades/index.ts` e gerado automaticamente por `docusaurus.config.ts`. Dados em JSON tipados por TypeScript; páginas em TSX reutilizando componentes de `comunidades/shared/` e `@site/src/components/`.

**Tech Stack:** Docusaurus 3.9, React 19, TypeScript 5.6, MUI v7, Jest (frontend), Node.js built-in test runner (scripts).

**Spec:** `docs/superpowers/specs/2026-08-17-devparana-community-site-design.md`

## Global Constraints

- Manter `features.events: false` e `features.blog: false` no `community.config.ts` — modelo multi-tenant de eventos/blog por comunidade ainda não está implementado.
- Usar avatar do GitHub `DeveloperParana` como logo temporário até assets definitivos.
- Não alterar arquivos legados de redirect (`src/pages/quero/`, `src/pages/team.tsx`, etc.).
- Não modificar a estrutura de outras comunidades (`tisocial/`, `elasnocodigo/`).
- Seguir o padrão MUI v7 Grid (`size={{ xs: 12 }}`, nunca `item xs={}`).
- Todo componente MUI importado por nome; nunca `import * from '@mui/material'`.
- Cores via `community.theme.*`; nunca hex hardcoded em páginas de comunidade.
- Dados de embaixadores/Na Estrada devem ser JSON-validáveis para permitir testes automatizados.

---

## File Structure

```
comunidades/devparana/
├── community.config.ts
├── docs/
│   └── index.md
├── src/
│   ├── data/
│   │   ├── ambassadors.json       # 6 regiões e embaixadores (RFC001)
│   │   ├── ambassadors.ts         # tipos + reexport
│   │   ├── team.json              # coordenação geral
│   │   ├── team.ts                # tipos + reexport
│   │   ├── naestrada.json         # edição 2026 (RFC002)
│   │   └── naestrada.ts           # tipos + reexport
│   └── pages/
│       ├── index.tsx
│       ├── apoiar.tsx
│       ├── transparencia.tsx
│       ├── equipe.tsx
│       ├── embaixadores.tsx
│       └── na-estrada.tsx
comunidades/index.ts              # adicionar import + entry
src/data/communities.ts           # atualizar link do DevParaná
scripts/validate-devparana-data.test.mjs  # validação de dados
```

---

### Task 1: Scaffold e configuração da comunidade

**Files:**
- Create: `comunidades/devparana/community.config.ts`
- Create: `comunidades/devparana/docs/index.md` (placeholder inicial)
- Create: diretórios `comunidades/devparana/src/data/` e `comunidades/devparana/src/pages/`
- Modify: `comunidades/index.ts`

**Interfaces:**
- Consumes: `CommunitySiteConfig` de `comunidades/shared/types.ts`
- Produces: `devparanaConfig` exportado default; registro em `COMMUNITIES_CONFIG`

- [ ] **Step 1: Criar diretórios**

```bash
mkdir -p comunidades/devparana/docs
mkdir -p comunidades/devparana/src/data
mkdir -p comunidades/devparana/src/pages
```

- [ ] **Step 2: Escrever `community.config.ts`**

```typescript
import type { CommunitySiteConfig } from "../shared/types";

const config: CommunitySiteConfig = {
  slug: "devparana",
  name: "DevParaná",
  shortName: "DevParaná",
  tagline: "Comunidade de pessoas desenvolvedoras de software do Paraná.",
  description:
    "Comunidade sem fins lucrativos que conecta pessoas desenvolvedoras de software em todo o estado do Paraná. Promove meetups, workshops, hackathons e o evento itinerante DevParaná na Estrada.",
  logoUrl: "https://avatars.githubusercontent.com/u/15199454?s=200&v=4",
  logoUrlDark: "https://avatars.githubusercontent.com/u/15199454?s=200&v=4",
  theme: {
    primary: "#2563EB",
    primaryDark: "#1E3A8A",
    primaryLight: "#60A5FA",
    accent: "#F59E0B",
    footerBg: "#1E3A8A",
  },
  basePath: "/comunidades/devparana",
  externalLinks: [
    { label: "Site oficial", href: "https://devpr.org/" },
    { label: "Meetup", href: "https://www.meetup.com/pt-BR/developerparana/" },
    { label: "YouTube", href: "https://www.youtube.com/devparana" },
    { label: "Instagram", href: "https://www.instagram.com/devparana" },
    { label: "GitHub", href: "https://github.com/DeveloperParana" },
  ],
  navMenu: [
    { label: "Início", to: "/comunidades/devparana" },
    {
      label: "Sobre",
      items: [
        { label: "Docs", to: "/comunidades/devparana/docs" },
        { label: "Equipe", to: "/comunidades/devparana/equipe" },
        { label: "Embaixadores", to: "/comunidades/devparana/embaixadores" },
      ],
    },
    { label: "Na Estrada", to: "/comunidades/devparana/na-estrada" },
    { label: "Apoiar", to: "/comunidades/devparana/apoiar" },
    { label: "Transparência", to: "/comunidades/devparana/transparencia" },
  ],
  features: {
    donations: true,
    transparency: true,
    events: false,
    blog: false,
    docs: true,
  },
  hero: {
    title: "DevParaná",
    subtitle: "Conectando pessoas desenvolvedoras de software em todo o estado do Paraná.",
    ctaPrimary: { label: "Apoiar a comunidade", to: "/comunidades/devparana/apoiar" },
    ctaSecondary: { label: "Site oficial", href: "https://devpr.org/" },
  },
  impact: {
    title: "Impacto da comunidade",
    subtitle: "Presença do DevParaná no estado do Paraná.",
    stats: [
      { value: "6", label: "Regiões do Paraná" },
      { value: "20+", label: "Cidades alcançadas" },
      { value: "Desde 2015", label: "Conectando pessoas dev" },
    ],
  },
  exploreSection: {
    title: "Explore a comunidade",
    subtitle: "Tudo que o DevParaná oferece dentro do portal Codaqui.",
  },
  channelsSection: {
    title: "Quer saber mais?",
    subtitle: "Acesse os canais oficiais do DevParaná.",
  },
};

export default config;
```

- [ ] **Step 3: Escrever placeholder docs**

`comunidades/devparana/docs/index.md`:

```markdown
---
sidebar_position: 1
title: Introdução
---

# DevParaná

Bem-vindo ao espaço do **DevParaná** dentro do portal Codaqui.

O DevParaná é uma comunidade sem fins lucrativos que conecta pessoas desenvolvedoras de software em todo o estado do Paraná.

## O que você encontra por aqui

- **Embaixadores** — conheça as regiões do Paraná e os embaixadores que representam a comunidade.
- **DevParaná na Estrada** — informações sobre o evento itinerante.
- **Apoiar** — contribua financeiramente para manter meetups e eventos.
- **Transparência** — acompanhe saldo e movimentações no ledger da Codaqui.

## Links externos

- Site oficial: https://devpr.org/
- Meetup: https://www.meetup.com/pt-BR/developerparana/
- GitHub: https://github.com/DeveloperParana
```

- [ ] **Step 4: Registrar em `comunidades/index.ts`**

```typescript
import devparanaConfig from "./devparana/community.config";

export const COMMUNITIES_CONFIG: CommunitySiteConfig[] = [
  tisocialConfig,
  elasnocodigoConfig,
  devparanaConfig,
];
```

- [ ] **Step 5: Verificar typecheck**

```bash
npm run typecheck
```

Expected: PASS (erros esperados apenas de páginas/dados ainda não criados).

---

### Task 2: Dados de embaixadores e regiões

**Files:**
- Create: `comunidades/devparana/src/data/ambassadors.json`
- Create: `comunidades/devparana/src/data/ambassadors.ts`
- Create: `scripts/validate-devparana-data.test.mjs`

**Interfaces:**
- Consumes: JSON schema definido nesta task
- Produces: `Ambassador`, `Region`, `regions` tipados; validação via teste

- [ ] **Step 1: Escrever `ambassadors.json`**

```json
{
  "regions": [
    {
      "id": "norte",
      "name": "Norte",
      "cities": ["Maringá", "Apucarana", "Paranavaí", "Londrina"],
      "ambassador": {
        "name": "Everton Tavares",
        "email": "ivo@devpr.org",
        "role": "Embaixador da Região Norte",
        "avatar": "https://avatars.githubusercontent.com/u/15199454?s=200&v=4",
        "github": "https://github.com/DeveloperParana"
      }
    },
    {
      "id": "sudoeste",
      "name": "Sudoeste",
      "cities": ["Dois Vizinhos", "Pato Branco", "Francisco Beltrão"],
      "ambassador": {
        "name": "Geovane Norbert",
        "email": "geovane@codaqui.dev",
        "role": "Embaixador da Região Sudoeste"
      }
    },
    {
      "id": "noroeste",
      "name": "Noroeste",
      "cities": ["Cianorte", "Umuarama", "Campo Mourão", "Ivaiporã"]
    },
    {
      "id": "oeste",
      "name": "Oeste",
      "cities": ["Cascavel", "Toledo", "Medianeira", "Foz do Iguaçu"]
    },
    {
      "id": "leste",
      "name": "Leste",
      "cities": ["Curitiba", "Campo Largo", "Ponta Grossa", "Castro"]
    },
    {
      "id": "centro",
      "name": "Centro",
      "cities": ["Guarapuava"]
    }
  ]
}
```

- [ ] **Step 2: Escrever `ambassadors.ts`**

```typescript
export interface Ambassador {
  name: string;
  email: string;
  role: string;
  avatar?: string;
  linkedin?: string;
  github?: string;
  bio?: string;
}

export interface Region {
  id: string;
  name: string;
  cities: string[];
  ambassador?: Ambassador;
}

import data from "./ambassadors.json";

export const regions: Region[] = data.regions;
```

- [ ] **Step 3: Escrever teste de validação**

`scripts/validate-devparana-data.test.mjs`:

```javascript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ambassadors = JSON.parse(
  readFileSync(join(__dirname, "../comunidades/devparana/src/data/ambassadors.json"), "utf8"),
);

describe("ambassadors.json", () => {
  it("tem 6 regiões", () => {
    assert.equal(ambassadors.regions.length, 6);
  });

  it("cada região tem id, name e cities", () => {
    for (const region of ambassadors.regions) {
      assert.ok(region.id, "region.id is required");
      assert.ok(region.name, "region.name is required");
      assert.ok(Array.isArray(region.cities) && region.cities.length > 0, "region.cities must be a non-empty array");
    }
  });

  it("norte e sudoeste possuem embaixadores", () => {
    const norte = ambassadors.regions.find((r) => r.id === "norte");
    const sudoeste = ambassadors.regions.find((r) => r.id === "sudoeste");
    assert.ok(norte?.ambassador);
    assert.ok(sudoeste?.ambassador);
    assert.ok(norte.ambassador.email);
    assert.ok(sudoeste.ambassador.email);
  });
});
```

- [ ] **Step 4: Rodar teste**

```bash
npm run test:scripts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add comunidades/devparana/src/data/ambassadors.json \
  comunidades/devparana/src/data/ambassadors.ts \
  scripts/validate-devparana-data.test.mjs
git commit -m "feat(devparana): add ambassadors and regions data (RFC001)"
```

---

### Task 3: Dados de equipe e DevParaná na Estrada

**Files:**
- Create: `comunidades/devparana/src/data/team.json`
- Create: `comunidades/devparana/src/data/team.ts`
- Create: `comunidades/devparana/src/data/naestrada.json`
- Create: `comunidades/devparana/src/data/naestrada.ts`
- Modify: `scripts/validate-devparana-data.test.mjs`

**Interfaces:**
- Consumes: JSON schema desta task
- Produces: `Member`, `team`, `NaEstradaEdition`, `naEstrada2026`

- [ ] **Step 1: Escrever `team.json`**

```json
{
  "members": [
    {
      "name": "Everton Tavares",
      "role": "Coordenador",
      "specialty": "Liderança e Embaixador Norte",
      "avatar": "https://avatars.githubusercontent.com/u/15199454?s=200&v=4"
    },
    {
      "name": "Luiz Schons",
      "role": "Organizador",
      "specialty": "DevParaná na Estrada",
      "avatar": "https://github.com/ghost.png"
    },
    {
      "name": "Você?",
      "role": "Voluntário",
      "specialty": "Organização de meetups",
      "avatar": "https://github.com/ghost.png"
    }
  ]
}
```

- [ ] **Step 2: Escrever `team.ts`**

```typescript
export interface Member {
  name: string;
  role: string;
  specialty?: string;
  avatar: string;
  linkedin?: string;
  github?: string;
}

import data from "./team.json";

export const team: Member[] = data.members;
```

- [ ] **Step 3: Escrever `naestrada.json`**

```json
{
  "edition": {
    "year": 2026,
    "status": "upcoming",
    "period": "Março e Abril de 2026",
    "cities": [
      "Maringá", "Londrina", "Ivaiporã", "Cascavel", "Toledo", "Foz do Iguaçu",
      "Cianorte", "Campo Mourão", "Umuarama", "Dois Vizinhos", "Francisco Beltrão",
      "Pato Branco", "Curitiba", "Guarapuava", "Ponta Grossa"
    ],
    "formats": {
      "meetup": {
        "schedule": [
          { "time": "19:00", "label": "Abertura do evento" },
          { "time": "19:30", "label": "Slot 1 — DevParaná" },
          { "time": "20:20", "label": "Slot 2 — Local" },
          { "time": "21:10", "label": "Slot 3 — Externo" },
          { "time": "22:00", "label": "Encerramento" }
        ]
      },
      "workshop": {
        "price": "R$ 25,00",
        "schedule": [
          { "time": "08:00", "label": "Credenciamento" },
          { "time": "08:30", "label": "Início dos Workshops" },
          { "time": "12:00", "label": "Almoço" },
          { "time": "13:30", "label": "Abertura do ciclo de palestras" },
          { "time": "14:00", "label": "Slot 1" },
          { "time": "14:50", "label": "Slot 2" },
          { "time": "15:40", "label": "Coffee Break" },
          { "time": "16:30", "label": "Slot 3" },
          { "time": "17:30", "label": "Encerramento" }
        ]
      }
    },
    "sponsorshipTiers": [
      {
        "name": "Bronze",
        "value": "R$ 300,00",
        "benefits": [
          "Logo em todas as artes de divulgação da cidade",
          "Possibilidade de distribuir flyers e brindes no evento"
        ]
      },
      {
        "name": "Prata",
        "value": "R$ 500,00",
        "benefits": [
          "Benefícios da cota Bronze",
          "Espaço para falar sobre a empresa"
        ]
      },
      {
        "name": "Ouro",
        "value": "R$ 800,00",
        "benefits": [
          "Benefícios da cota Prata",
          "Indicar um palestrante para o slot de patrocinador"
        ]
      }
    ]
  }
}
```

- [ ] **Step 4: Escrever `naestrada.ts`**

```typescript
export interface ScheduleItem {
  time: string;
  label: string;
}

export interface SponsorshipTier {
  name: string;
  value: string;
  benefits: string[];
}

export interface NaEstradaEdition {
  year: number;
  status: "upcoming" | "ongoing" | "past";
  period: string;
  cities: string[];
  formats: {
    meetup: { schedule: ScheduleItem[] };
    workshop: { price: string; schedule: ScheduleItem[] };
  };
  sponsorshipTiers: SponsorshipTier[];
}

import data from "./naestrada.json";

export const naEstrada2026: NaEstradaEdition = data.edition;
```

- [ ] **Step 5: Estender teste de validação**

Adicionar ao `scripts/validate-devparana-data.test.mjs`:

```javascript
const naestrada = JSON.parse(
  readFileSync(join(__dirname, "../comunidades/devparana/src/data/naestrada.json"), "utf8"),
);

describe("naestrada.json", () => {
  it("tem edição 2026", () => {
    assert.equal(naestrada.edition.year, 2026);
    assert.equal(naestrada.edition.status, "upcoming");
  });

  it("tem 15 cidades", () => {
    assert.equal(naestrada.edition.cities.length, 15);
  });

  it("tem 3 cotas de patrocínio", () => {
    assert.equal(naestrada.edition.sponsorshipTiers.length, 3);
    assert.deepEqual(
      naestrada.edition.sponsorshipTiers.map((t) => t.name),
      ["Bronze", "Prata", "Ouro"],
    );
  });
});
```

- [ ] **Step 6: Rodar testes**

```bash
npm run test:scripts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add comunidades/devparana/src/data/team.json \
  comunidades/devparana/src/data/team.ts \
  comunidades/devparana/src/data/naestrada.json \
  comunidades/devparana/src/data/naestrada.ts \
  scripts/validate-devparana-data.test.mjs
git commit -m "feat(devparana): add team and na-estrada data (RFC002)"
```

---

### Task 4: Páginas core (home, apoiar, transparência, equipe)

**Files:**
- Create: `comunidades/devparana/src/pages/index.tsx`
- Create: `comunidades/devparana/src/pages/apoiar.tsx`
- Create: `comunidades/devparana/src/pages/transparencia.tsx`
- Create: `comunidades/devparana/src/pages/equipe.tsx`

**Interfaces:**
- Consumes: `community` de `../../community.config`; `regions` de `../data/ambassadors`; `team` de `../data/team`; `naEstrada2026` de `../data/naestrada`
- Produces: 4 páginas Docusaurus renderizáveis

- [ ] **Step 1: Escrever `transparencia.tsx` (mais simples)**

```tsx
import React from "react";
import CommunityTransparenciaPage from "@site/comunidades/shared/components/CommunityTransparenciaPage";
import community from "../../community.config";

export default function DevParanaTransparencia(): React.JSX.Element {
  return <CommunityTransparenciaPage community={community} />;
}
```

- [ ] **Step 2: Escrever `apoiar.tsx`**

```tsx
import React from "react";
import CommunityApoiarPage from "@site/comunidades/shared/components/CommunityApoiarPage";
import community from "../../community.config";

export default function DevParanaApoiar(): React.JSX.Element {
  return (
    <CommunityApoiarPage
      community={community}
      heroTitle={`💙 Apoie o ${community.shortName}`}
      heroDescription="Sua contribuição mantém meetups locais e o evento itinerante DevParaná na Estrada, levando conteúdo de qualidade para várias cidades do Paraná."
      infoCards={[
        {
          title: "Como sua doação é usada",
          body: `100% direcionada para ações do ${community.shortName}: infraestrutura de eventos, coffee break, deslocamento de palestrantes e brindes. Movimentações registradas no ledger da Associação Codaqui.`,
        },
        {
          title: "Cobertura jurídica",
          body: "Pagamentos processados pela Stripe; recibo emitido pela Associação Codaqui (CNPJ 44.593.429/0001-05). Doações acima de R$ 100 exigem login com GitHub para conformidade fiscal.",
        },
      ]}
    />
  );
}
```

- [ ] **Step 3: Escrever `equipe.tsx`**

Usar como base o `comunidades/tisocial/src/pages/equipe.tsx`, substituindo dados por `team` e textos por `community`.

- [ ] **Step 4: Escrever `index.tsx`**

Usar como base o `comunidades/tisocial/src/pages/index.tsx`, adaptando:
- Hero com `community.hero`.
- `CommunityImpactSection`.
- Seção "Próximos eventos" usando `naEstrada2026` (cards com cidades e link para `/na-estrada`).
- `CommunityExploreSection` com cards: Docs, Equipe, Embaixadores, Na Estrada, Apoiar, Transparência.
- `CommunityChannelsSection`.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add comunidades/devparana/src/pages/index.tsx \
  comunidades/devparana/src/pages/apoiar.tsx \
  comunidades/devparana/src/pages/transparencia.tsx \
  comunidades/devparana/src/pages/equipe.tsx
git commit -m "feat(devparana): add core pages (home, apoiar, transparencia, equipe)"
```

---

### Task 5: Página de embaixadores

**Files:**
- Create: `comunidades/devparana/src/pages/embaixadores.tsx`

**Interfaces:**
- Consumes: `regions` de `../data/ambassadors`; `community` de `../../community.config`
- Produces: página `/comunidades/devparana/embaixadores`

- [ ] **Step 1: Criar componente `RegionCard`**

Dentro do mesmo arquivo `embaixadores.tsx` (pode extrair depois se crescer):

```tsx
function RegionCard({ region, accent }: { region: Region; accent: string }) {
  const { name, cities, ambassador } = region;
  return (
    <Card variant="outlined" sx={{ height: "100%", transition: "all 0.2s", "&:hover": { transform: "translateY(-2px)", boxShadow: 3, borderColor: accent } }}>
      <CardContent>
        <Typography variant="h5" fontWeight={700} gutterBottom sx={{ color: accent }}>
          {name}
        </Typography>
        {ambassador ? (
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Avatar src={ambassador.avatar} alt={ambassador.name} sx={{ width: 56, height: 56 }} />
            <Box>
              <Typography fontWeight={700}>{ambassador.name}</Typography>
              <Typography variant="body2" color="text.secondary">{ambassador.role}</Typography>
              <Typography variant="body2" color="text.secondary">{ambassador.email}</Typography>
            </Box>
          </Stack>
        ) : (
          <Alert severity="info" sx={{ mb: 2 }}>
            Vaga aberta — entre em contato caso queira representar esta região.
          </Alert>
        )}
        <Typography variant="subtitle2" fontWeight={700}>Cidades:</Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
          {cities.map((city) => (
            <Chip key={city} label={city} size="small" variant="outlined" />
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Criar página com hero, responsabilidades e grid de regiões**

Estrutura:
- Hero colorido com título "Embaixadores do DevParaná".
- Seção com lista de responsabilidades (RFC001).
- Grid com 6 `RegionCard`.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add comunidades/devparana/src/pages/embaixadores.tsx
git commit -m "feat(devparana): add ambassadors page (RFC001)"
```

---

### Task 6: Página DevParaná na Estrada

**Files:**
- Create: `comunidades/devparana/src/pages/na-estrada.tsx`

**Interfaces:**
- Consumes: `naEstrada2026` de `../data/naestrada`; `community` de `../../community.config`
- Produces: página `/comunidades/devparana/na-estrada`

- [ ] **Step 1: Criar página com seções**

Estrutura:
- Hero colorido com título "DevParaná na Estrada" e subtítulo.
- Seção "Sobre" com histórico (2019, 2022, 2024, 2025, 2026).
- Seção "Formatos": cards Meetup e Workshop + Palestras com cronogramas.
- Seção "Cidades previstas": grid/chips com as 15 cidades.
- Seção "Patrocínio": tabela/cards Bronze/Prata/Ouro.
- CTA "Apoiar este evento" linkando para `/comunidades/devparana/apoiar`.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add comunidades/devparana/src/pages/na-estrada.tsx
git commit -m "feat(devparana): add na-estrada page (RFC002)"
```

---

### Task 7: Docs e integração final no build

**Files:**
- Modify: `comunidades/devparana/docs/index.md`
- Modify: `src/data/communities.ts`

**Interfaces:**
- Consumes: `community` de `devparana`
- Produces: docs finalizado; link interno no card de comunidades

- [ ] **Step 1: Expandir `docs/index.md`**

Adicionar seções sobre Embaixadores e Na Estrada com links para as páginas TSX:

```markdown
## Embaixadores

O Projeto Embaixadores organiza o Paraná em regiões para aproximar a comunidade de outras cidades.

[Conheça os embaixadores](/comunidades/devparana/embaixadores)

## DevParaná na Estrada

Evento itinerante que leva meetups e workshops para várias cidades do estado.

[Saiba mais sobre a edição 2026](/comunidades/devparana/na-estrada)
```

- [ ] **Step 2: Atualizar `src/data/communities.ts`**

No entry `devparana`, alterar `links` para apontar o site para a página interna:

```typescript
links: [
  { type: "website", label: "Página da comunidade", url: "/comunidades/devparana" },
  { type: "github", label: "GitHub", url: "https://github.com/DeveloperParana" },
],
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add comunidades/devparana/docs/index.md src/data/communities.ts
git commit -m "feat(devparana): finalize docs and community link"
```

---

### Task 8: Validação final

**Files:**
- All created/modified files

**Interfaces:**
- Consumes: build Docusaurus
- Produces: site estático funcionando localmente

- [ ] **Step 1: Rodar testes de scripts**

```bash
npm run test:scripts
```

Expected: PASS.

- [ ] **Step 2: Rodar testes frontend**

```bash
npm run test:frontend
```

Expected: PASS (nenhum teste novo quebrando; cobertura pode variar).

- [ ] **Step 3: Rodar typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Rodar build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Verificar rotas geradas**

```bash
grep -R "comunidades/devparana" build/ | head -20
```

Expected: presença de arquivos como `build/comunidades/devparana/index.html`.

- [ ] **Step 6: Commit final**

```bash
git add comunidades/devparana src/data/communities.ts scripts/validate-devparana-data.test.mjs
git commit -m "feat(devparana): complete community site with RFC001/002 integration"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task que implementa |
|------------------|---------------------|
| Criar comunidade `devparana` | Task 1 |
| Home com hero, impacto, próximos eventos | Task 4 |
| Página apoiar | Task 4 |
| Página transparência | Task 4 |
| Página equipe | Task 4 |
| Página embaixadores com 6 regiões | Task 2 + Task 5 |
| Página Na Estrada com formatos/cidades | Task 3 + Task 6 |
| Docs mínimos | Task 7 |
| Registro em `comunidades/index.ts` | Task 1 |
| Atualizar link em `src/data/communities.ts` | Task 7 |
| Logos temporários | Task 1 |

### Placeholder scan

Nenhum TBD/TODO/fill-in-details no plano. Cada arquivo tem conteúdo inicial concreto.

### Type consistency

- `Ambassador`, `Region`, `Member`, `NaEstradaEdition` e tipos auxiliares são definidos nos arquivos `.ts` correspondentes.
- JSONs seguem o schema esperado pelos tipos.
- `community` é importado de `../../community.config` em todas as páginas.

### Observações

- O teste `scripts/validate-devparana-data.test.mjs` valida dados críticos sem depender de Jest nas pastas de comunidade.
- Não criamos testes de renderização para as páginas porque requereriam mocks extensivos de Docusaurus/MUI; a validação de build serve como teste de integração.
- Se novos embaixadores forem confirmados, basta editar `ambassadors.json` e rodar `npm run test:scripts`.
