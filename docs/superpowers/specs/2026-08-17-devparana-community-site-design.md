<!-- AGENT-INDEX
purpose: Design spec para criação do site da comunidade DevParaná dentro do portal Codaqui, seguindo o modelo multi-tenant de comunidades e integrando as RFCs 001 (Embaixadores) e 002 (DevParaná na Estrada).
audience: AI agents, mantenedores
status: Draft / aguardando aprovação
sections:
  - Contexto e objetivo
  - Escopo
  - Estrutura de arquivos
  - Configuração da comunidade
  - Páginas e componentes
  - Dados: embaixadores, regiões e cidades
  - Eventos: DevParaná na Estrada
  - Assets e identidade visual
  - Integração no build
  - Testes e validação
  - Riscos e próximos passos
related-docs:
  - AGENTS.md — arquitetura multi-tenant de comunidades
  - docs/adrs/004-multisite-communities.md — decisão arquitetural
  - temp-devparana-rfcs/💬 RFC001 - Projeto Embaixadores.docx
  - temp-devparana-rfcs/💬 RFC002 - DevParaná na Estrada 2026.docx
agent-protocol:
  - Este é um design spec; a implementação deve ser precedida do skill writing-plans.
  - Não alterar arquivos legados de redirect nem a estrutura de outras comunidades.
-->

# Design Spec — Site da Comunidade DevParaná

## 1. Contexto e objetivo

O DevParaná é uma das comunidades parceiras da Associação Codaqui. Diferente das demais comunidades já hospedadas (T.I. Social, Elas no Código), o DevParaná possui duas características distintivas documentadas nas RFCs em `temp-devparana-rfcs/`:

- **RFC001 — Projeto Embaixadores:** organização do estado do Paraná em 6 regiões, cada uma com cidades e um embaixador como ponto de referência.
- **RFC002 — DevParaná na Estrada 2026:** evento itinerante com meetups e workshops em múltiplas cidades do Paraná, com coordenação local, patrocínios e Call4Papers.

O objetivo deste trabalho é criar o site da comunidade DevParaná dentro do modelo multi-tenant já estabelecido em `comunidades/<slug>/`, reaproveitando os componentes compartilhados e adicionando páginas específicas para refletir as estruturas definidas nas RFCs.

## 2. Escopo

### Dentro do escopo

1. Criar a comunidade `devparana` em `comunidades/devparana/`.
2. Home (`/comunidades/devparana`) com hero, impacto, próximos eventos e exploração.
3. Página de apoio (`/comunidades/devparana/apoiar`) usando `DonationFlow`.
4. Página de transparência (`/comunidades/devparana/transparencia`) usando `CommunityTransparenciaPage`.
5. Página de equipe (`/comunidades/devparana/equipe`) com coordenadores e lideranças.
6. Página de embaixadores (`/comunidades/devparana/embaixadores`) com mapa/cards das 5 regiões e cidades (RFC001).
7. Página do DevParaná na Estrada (`/comunidades/devparana/na-estrada`) com formatos, cronograma e CTA (RFC002).
8. Docs mínimos (`/comunidades/devparana/docs`) com introdução e links para as RFCs.
9. Registro em `comunidades/index.ts` e atualização do link da comunidade em `src/data/communities.ts`.
10. Logos temporários usando o avatar oficial do GitHub `DeveloperParana` até assets definitivos.

### Fora do escopo (futuro)

- Domínio próprio (`devpr.org` como reverse-proxy via Cloudflare Worker).
- Integração automática de eventos do Meetup na aba da comunidade (`features.events: true` ainda não está implementado no modelo multi-tenant; o link de eventos apontará para `/eventos` global).
- Backend de inscrições/patrocínios específico para o DevParaná na Estrada.

## 3. Estrutura de arquivos

```
comunidades/devparana/
├── community.config.ts
├── docs/
│   └── index.md
├── src/
│   ├── data/
│   │   ├── ambassadors.ts        # embaixadores, regiões e cidades (RFC001)
│   │   ├── team.ts               # coordenação geral e lideranças
│   │   └── naestrada.ts          # dados do evento itinerante (RFC002)
│   └── pages/
│       ├── index.tsx             # home
│       ├── apoiar.tsx            # doação
│       ├── transparencia.tsx     # transparência financeira
│       ├── equipe.tsx            # equipe
│       ├── embaixadores.tsx      # regiões e embaixadores
│       └── na-estrada.tsx        # DevParaná na Estrada
```

## 4. Configuração da comunidade

Arquivo: `comunidades/devparana/community.config.ts`

```typescript
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
    primary: "#2563EB",      // azul forte — cor já associada ao DevParaná
    primaryDark: "#1E3A8A",
    primaryLight: "#60A5FA",
    accent: "#F59E0B",       // âmbar — contraste para CTAs
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
    events: false,            // modelo ainda não implementado para comunidades
    blog: false,              // sem posts planejados no momento
    docs: true,
  },
  hero: {
    title: "DevParaná",
    subtitle:
      "Conectando pessoas desenvolvedoras de software em todo o estado do Paraná.",
    ctaPrimary: { label: "Apoiar a comunidade", to: "/comunidades/devparana/apoiar" },
    ctaSecondary: { label: "Conhecer o DevPR na Estrada", href: "/comunidades/devparana/na-estrada" },
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
```

## 5. Páginas e componentes

### 5.1 Home (`index.tsx`)

- Reaproveita padrão do T.I. Social: hero colorido, `CommunityImpactSection`, seção de próximos eventos (usando dados de `naestrada.ts`), `CommunityExploreSection` e `CommunityChannelsSection`.
- Cards de exploração: Docs, Equipe, Embaixadores, Apoiar, Transparência, Na Estrada.

### 5.2 Apoiar (`apoiar.tsx`)

- Usa `CommunityApoiarPage` com:
  - `heroTitle`: "💙 Apoie o DevParaná"
  - `heroDescription`: destaca que o apoio mantém meetups e o DevParaná na Estrada.
  - `infoCards`: explicação sobre rastreamento no ledger e cobertura jurídica da Codaqui.

### 5.3 Transparência (`transparencia.tsx`)

- Wrapper simples em torno de `CommunityTransparenciaPage`.

### 5.4 Equipe (`equipe.tsx`)

- Similar ao `equipe.tsx` do T.I. Social, listando coordenação geral do DevParaná a partir de `team.ts`.

### 5.5 Embaixadores (`embaixadores.tsx`)

- Nova página. Estrutura:
  - Hero explicando o Projeto Embaixadores (RFC001).
  - Seção de responsabilidades do embaixador (lista com ícones).
  - Grid de 6 cards de região, cada um com:
    - Nome da região
    - Embaixador (nome, email, avatar, LinkedIn/GitHub quando disponível)
    - Lista de cidades da região
- Dados consumidos de `ambassadors.ts`.

### 5.6 Na Estrada (`na-estrada.tsx`)

- Nova página. Estrutura:
  - Hero com título "DevParaná na Estrada" e subtítulo.
  - Seção "Sobre" com histórico e objetivo.
  - Seção "Formatos": Meetup (3 slots de 50 min) e Workshop + Palestras (sábado, inscrição R$ 25).
  - Seção "Patrocínio": cotas Bronze/Prata/Ouro e patrocínio local.
  - Seção "Cidades previstas" (lista de cidades da edição 2026, extraída da RFC002).
  - CTA para apoiar a comunidade.
- Dados consumidos de `naestrada.ts`.

## 6. Dados: embaixadores, regiões e cidades

Arquivo: `comunidades/devparana/src/data/ambassadors.ts`

Estrutura proposta:

```typescript
export interface Ambassador {
  name: string;
  email: string;
  role: string;
  region: string;
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

export const regions: Region[] = [
  {
    id: "norte",
    name: "Norte",
    cities: ["Maringá", "Apucarana", "Paranavaí", "Londrina"],
    ambassador: {
      name: "Everton Tavares",
      email: "ivo@devpr.org",
      role: "Embaixador da Região Norte",
      region: "Norte",
      github: "https://github.com/...",
    },
  },
  {
    id: "sudoeste",
    name: "Sudoeste",
    cities: ["Dois Vizinhos", "Pato Branco", "Francisco Beltrão"],
    ambassador: {
      name: "Geovane Norbert",
      email: "geovane@codaqui.dev",
      role: "Embaixador da Região Sudoeste",
      region: "Sudoeste",
    },
  },
  // ... Noroeste, Oeste, Leste, Centro
];
```

> Nota: os nomes dos embaixadores das demais regiões não constam explicitamente na RFC001. Quando não houver nome confirmado, o campo `ambassador` ficará `undefined` e a página exibirá "Vaga aberta — entre em contato".

## 7. Eventos: DevParaná na Estrada

Arquivo: `comunidades/devparana/src/data/naestrada.ts`

Estrutura proposta:

```typescript
export interface NaEstradaEdition {
  year: number;
  status: "upcoming" | "ongoing" | "past";
  period: string;
  cities: string[];
  formats: {
    meetup: {
      schedule: { time: string; label: string }[];
    };
    workshop: {
      schedule: { time: string; label: string }[];
      price: string;
    };
  };
  sponsorshipTiers: { name: string; value: string; benefits: string[] }[];
}

export const naEstrada2026: NaEstradaEdition = {
  year: 2026,
  status: "upcoming",
  period: "Março e Abril de 2026",
  cities: [
    "Maringá", "Londrina", "Ivaiporã", "Cascavel", "Toledo", "Foz do Iguaçu",
    "Cianorte", "Campo Mourão", "Umuarama", "Dois Vizinhos", "Francisco Beltrão",
    "Pato Branco", "Curitiba", "Guarapuava", "Ponta Grossa",
  ],
  formats: { /* ... */ },
  sponsorshipTiers: [
    { name: "Bronze", value: "R$ 300,00", benefits: [...] },
    { name: "Prata", value: "R$ 500,00", benefits: [...] },
    { name: "Ouro", value: "R$ 800,00", benefits: [...] },
  ],
};
```

## 8. Assets e identidade visual

- **Logos:** usar o avatar oficial do GitHub `DeveloperParana` (`https://avatars.githubusercontent.com/u/15199454?s=200&v=4`) como placeholder até que um logo vetorial seja adicionado a `static/img/`.
- **Cores:** azul (`#2563EB`) como primária, âmbar (`#F59E0B`) como destaque.
- **Favicon:** herdar favicon do site Codaqui.

## 9. Integração no build

1. **Importar config** em `comunidades/index.ts`:
   ```typescript
   import devparanaConfig from "./devparana/community.config";
   export const COMMUNITIES_CONFIG: CommunitySiteConfig[] = [
     tisocialConfig,
     elasnocodigoConfig,
     devparanaConfig,
   ];
   ```

2. **Atualizar link da comunidade** em `src/data/communities.ts`:
   - Alterar o link do DevParaná de `https://devpr.org/` para `/comunidades/devparana` (manter o link externo como secondary, se a interface permitir; como só existe um `links[]`, substituir para apontar internamente).

3. **docusaurus.config.ts** já gera plugins automaticamente a partir de `COMMUNITIES_CONFIG`. Nenhuma alteração manual necessária.

## 10. Testes e validação

- `npm run typecheck` — TypeScript deve passar.
- `npm run build` — build completo deve passar.
- Navegação local:
  - `/comunidades/devparana` renderiza home.
  - `/comunidades/devparana/embaixadores` lista 6 regiões.
  - `/comunidades/devparana/na-estrada` mostra formatos e cidades.
  - `/comunidades/devparana/apoiar` carrega `DonationFlow`.
  - Navbar dentro da comunidade mostra itens do DevParaná.
  - Chip "Codaqui" aparece no navbar para voltar ao site principal.

## 11. Riscos e próximos passos

| Risco | Mitigação |
|-------|-----------|
| Nomes/avatar de embaixadores incompletos | Exibir "Vaga aberta" para regiões sem embaixador confirmado; manter dados em arquivo TS fácil de atualizar. |
| Logos não otimizados | Usar avatar do GitHub temporariamente; tamanho 200×200 é aceitável para navbar. |
| `features.events` não implementado para comunidades | Manter `events: false`; link para eventos aponta para `/eventos` global. |
| Domínio próprio (devpr.org) | Fora de escopo; Worker reusable em `workers/tisocial/` pode ser copiado no futuro. |

### Próximos passos pós-implantação

1. Substituir logos por versões vetoriais em `static/img/devparana.{svg,png}`.
2. Confirmar nomes e contatos dos embaixadores das demais regiões.
3. Quando `features.events` for implementado no modelo multi-tenant, habilitar e filtrar eventos do DevParaná.
4. Avaliar domínio próprio via Cloudflare Worker.
