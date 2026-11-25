import type { ProjectCategory } from './project-category';

export interface CatalogSeedEntry {
  slug: string;
  name: string;
  summary: string;
  entitySlug: 'codaqui' | 'devparana' | 'tisocial';
  category: ProjectCategory;
  status: 'active' | 'finished';
  kind: 'programa' | 'projeto' | null;
  canonicalUrl: string;
  startsAt?: string;
}

export const CATALOG_SEED: CatalogSeedEntry[] = [
  {
    slug: 'boletim-diario-seguranca',
    name: 'Boletim Diário de Segurança',
    summary: 'Todos os dias às 10h, um bot publica um boletim com notícias sobre segurança da informação.',
    entitySlug: 'codaqui', category: 'open_source', status: 'active', kind: 'projeto',
    canonicalUrl: 'https://github.com/codaqui/boletim-diario-seguranca',
  },
  {
    slug: 'laboratorio-de-data-analytics',
    name: 'Laboratório de Data Analytics',
    summary: 'Laboratório para aprender Data Analytics, testando conceitos e brincando com Python.',
    entitySlug: 'codaqui', category: 'open_source', status: 'active', kind: 'projeto',
    canonicalUrl: 'https://github.com/codaqui/dados',
  },
  {
    slug: 'secret-sharing',
    name: 'Secret Sharing',
    summary: 'Gerador e compartilhador de senhas para demonstrar a capacidade do PiPing Server.',
    entitySlug: 'codaqui', category: 'open_source', status: 'active', kind: 'projeto',
    canonicalUrl: 'https://github.com/codaqui/secret-sharing',
  },
  {
    slug: 'github-action-freediskspace',
    name: 'GitHub Action FreeDiskSpace',
    summary: 'GitHub Action para limpar o espaço em disco dos Runners SaaS do GitHub.',
    entitySlug: 'codaqui', category: 'open_source', status: 'active', kind: 'projeto',
    canonicalUrl: 'https://github.com/endersonmenezes/free-disk-space',
  },
  {
    slug: 'codeowners-super-power',
    name: 'CODEOWNERS Super Power',
    summary: 'GitHub Action que aumenta o poder do arquivo CODEOWNERS dentro do GitHub.',
    entitySlug: 'codaqui', category: 'open_source', status: 'active', kind: 'projeto',
    canonicalUrl: 'https://github.com/endersonmenezes/codeowners-superpowers',
  },
  {
    slug: 'laboratorio-de-terraform',
    name: 'Laboratório de Terraform',
    summary: 'Laboratório para estudar Terraform dentro da Codaqui.',
    entitySlug: 'codaqui', category: 'open_source', status: 'active', kind: 'projeto',
    canonicalUrl: 'https://github.com/codaqui/terraform-organization',
  },
  {
    slug: 'tutor',
    name: 'Tutor',
    summary: 'Aplicação para explorar Python e conceitos do mundo de Desenvolvimento.',
    entitySlug: 'codaqui', category: 'open_source', status: 'active', kind: 'projeto',
    canonicalUrl: 'https://github.com/codaqui/tutor',
  },
  {
    slug: 'copilot-dashboard',
    name: 'Copilot Dashboard',
    summary: 'Painel para visualizar e analisar dados de uso do GitHub Copilot.',
    entitySlug: 'codaqui', category: 'open_source', status: 'active', kind: 'projeto',
    canonicalUrl: 'https://github.com/codaqui/copilot-dashboard',
  },
  {
    slug: 'backstage-lab',
    name: 'Backstage Lab',
    summary: 'Projeto para explorar o Backstage, a plataforma open source de developer portal da Spotify.',
    entitySlug: 'codaqui', category: 'open_source', status: 'active', kind: 'projeto',
    canonicalUrl: 'https://github.com/codaqui/backstage',
  },
  {
    slug: 'translate-talks',
    name: 'Translate Talks',
    summary: 'Tradução em tempo real das talks de eventos para melhorar a acessibilidade para pessoas com deficiência auditiva.',
    entitySlug: 'devparana', category: 'open_source', status: 'active', kind: 'projeto',
    canonicalUrl: 'https://github.com/DeveloperParana/translate-talks',
  },
  {
    slug: 'sorteio-app',
    name: 'Sorteio App',
    summary: 'Aplicação para realizar sorteios nos eventos e meetups das comunidades.',
    entitySlug: 'devparana', category: 'open_source', status: 'active', kind: 'projeto',
    canonicalUrl: 'https://github.com/DeveloperParana/sorteio-app',
  },
  {
    slug: 'codaqui-universitario',
    name: 'Codaqui Universitário',
    summary: 'Conectamos instituições de ensino, embaixadores e participantes em encontros de tecnologia.',
    entitySlug: 'codaqui', category: 'program', status: 'active', kind: 'programa',
    canonicalUrl: '/universitario',
  },
  {
    slug: 'embaixadores-devparana',
    name: 'Embaixadores do DevParaná',
    summary: 'O Projeto Embaixadores organiza o DevParaná em regiões do estado, garantindo que cada cidade tenha uma pessoa de referência.',
    entitySlug: 'devparana', category: 'program', status: 'active', kind: 'programa',
    canonicalUrl: 'https://devparana.org/embaixadores',
  },
  {
    slug: 'tisocial-pascoa-2025',
    name: 'Páscoa 2025: 632 Sorrisos',
    summary: 'Nossa primeira grande ação de 2025 foi um sucesso absoluto. Com o apoio da comunidade, conseguimos levar a magia da Páscoa para centenas de crianças.',
    entitySlug: 'tisocial', category: 'campaign', status: 'finished', kind: null,
    canonicalUrl: 'https://tisocial.org.br/blog/pascoa-2025', startsAt: '2025-04-15',
  },
  {
    slug: 'tisocial-level-up-careers-2025',
    name: 'Level Up Careers: Educação e Tecnologia',
    summary: 'Um evento focado em impulsionar carreiras através do conhecimento técnico e networking.',
    entitySlug: 'tisocial', category: 'campaign', status: 'finished', kind: null,
    canonicalUrl: 'https://tisocial.org.br/blog/level-up-careers-2025', startsAt: '2025-05-20',
  },
  {
    slug: 'tisocial-batalha-contra-o-frio-2025',
    name: 'A Batalha Contra o Frio',
    summary: 'Nossa maior campanha de arrecadação de agasalhos e mantimentos para o inverno de 2025.',
    entitySlug: 'tisocial', category: 'campaign', status: 'finished', kind: null,
    canonicalUrl: 'https://tisocial.org.br/blog/batalha-contra-o-frio-2025', startsAt: '2025-07-10',
  },
  {
    slug: 'tisocial-cestou-2025',
    name: 'Campanha Cestou: Segurança Alimentar',
    summary: 'Focada em garantir o alimento na mesa de famílias em situação de vulnerabilidade.',
    entitySlug: 'tisocial', category: 'campaign', status: 'finished', kind: null,
    canonicalUrl: 'https://tisocial.org.br/blog/cestou-2025', startsAt: '2025-07-25',
  },
  {
    slug: 'tisocial-dia-mundial-limpeza-2025',
    name: 'Dia Mundial da Limpeza: Sustentabilidade na Prática',
    summary: 'Em setembro, a T.I. Social se uniu ao movimento global pelo meio ambiente, realizando ações de plantio e conscientização sobre reciclagem.',
    entitySlug: 'tisocial', category: 'campaign', status: 'finished', kind: null,
    canonicalUrl: 'https://tisocial.org.br/blog/dia-mundial-limpeza-2025', startsAt: '2025-09-20',
  },
  {
    slug: 'tisocial-workshop-seguranca-digital-2025',
    name: 'Workshop: Educação e Segurança Digital para Terceira Idade',
    summary: 'A inclusão digital não tem idade. Realizamos um workshop focado em segurança e uso consciente da tecnologia para idosos.',
    entitySlug: 'tisocial', category: 'campaign', status: 'finished', kind: null,
    canonicalUrl: 'https://tisocial.org.br/blog/workshop-seguranca-digital-2025', startsAt: '2025-10-05',
  },
  {
    slug: 'tisocial-dia-das-criancas-2025',
    name: 'Dia das Crianças: Sorrisos que Transformam',
    summary: 'Celebramos o Dia das Crianças com uma ação especial focada em levar alegria e diversão para pequenos em situação de vulnerabilidade.',
    entitySlug: 'tisocial', category: 'campaign', status: 'finished', kind: null,
    canonicalUrl: 'https://tisocial.org.br/blog/dia-das-criancas-2025', startsAt: '2025-10-11',
  },
  {
    slug: 'tisocial-no-shave-november-2025',
    name: 'No Shave November: Investindo na Generosidade',
    summary: 'Sob o mote "Economize no estilo e invista na generosidade", incentivamos nossa comunidade a converter pequenos gastos pessoais em doações para o Natal.',
    entitySlug: 'tisocial', category: 'campaign', status: 'finished', kind: null,
    canonicalUrl: 'https://tisocial.org.br/blog/no-shave-november-2025', startsAt: '2025-11-30',
  },
  {
    slug: 'tisocial-pet-fevereiro-2026',
    name: 'Ação PET Fevereiro 2026: Impacto e Transparência',
    summary: 'Em fevereiro, nossos amigos de quatro patas foram o foco da nossa missão. Unimos forças com a comunidade para garantir cuidado e saúde para animais em situação de vulnerabilidade.',
    entitySlug: 'tisocial', category: 'campaign', status: 'finished', kind: null,
    canonicalUrl: 'https://tisocial.org.br/blog/pet-fevereiro-2026', startsAt: '2026-02-15',
  },
  {
    slug: 'tisocial-pascoa-2026',
    name: 'Páscoa Solidária 2026: Missão Cumprida!',
    summary: 'Nossa campanha de Páscoa 2026 foi um sucesso absoluto! Graças à colaboração de todos, conseguimos levar doçura e alegria para centenas de pessoas.',
    entitySlug: 'tisocial', category: 'campaign', status: 'finished', kind: null,
    canonicalUrl: 'https://tisocial.org.br/blog/pascoa-2026', startsAt: '2026-03-15',
  },
];
