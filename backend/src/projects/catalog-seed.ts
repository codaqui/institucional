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

type CatalogSeedTuple = readonly [
  slug: string,
  name: string,
  summary: string,
  entitySlug: CatalogSeedEntry['entitySlug'],
  canonicalUrl: string,
  startsAt?: string,
];

function catalogEntries(
  category: ProjectCategory,
  status: CatalogSeedEntry['status'],
  kind: CatalogSeedEntry['kind'],
  entries: readonly CatalogSeedTuple[],
): CatalogSeedEntry[] {
  return entries.map(([slug, name, summary, entitySlug, canonicalUrl, startsAt]) => ({
    slug, name, summary, entitySlug, category, status, kind, canonicalUrl, startsAt,
  }));
}

export const CATALOG_SEED: CatalogSeedEntry[] = [
  ...catalogEntries('open_source', 'active', 'projeto', [
    [
      'boletim-diario-seguranca',
      'Boletim Diário de Segurança',
      'Todos os dias às 10h, um bot publica um boletim com notícias sobre segurança da informação.',
      'codaqui',
      'https://github.com/codaqui/boletim-diario-seguranca',
    ],
    [
      'laboratorio-de-data-analytics',
      'Laboratório de Data Analytics',
      'Laboratório para aprender Data Analytics, testando conceitos e brincando com Python.',
      'codaqui',
      'https://github.com/codaqui/dados',
    ],
    [
      'secret-sharing',
      'Secret Sharing',
      'Gerador e compartilhador de senhas para demonstrar a capacidade do PiPing Server.',
      'codaqui',
      'https://github.com/codaqui/secret-sharing',
    ],
    [
      'github-action-freediskspace',
      'GitHub Action FreeDiskSpace',
      'GitHub Action para limpar o espaço em disco dos Runners SaaS do GitHub.',
      'codaqui',
      'https://github.com/endersonmenezes/free-disk-space',
    ],
    [
      'codeowners-super-power',
      'CODEOWNERS Super Power',
      'GitHub Action que aumenta o poder do arquivo CODEOWNERS dentro do GitHub.',
      'codaqui',
      'https://github.com/endersonmenezes/codeowners-superpowers',
    ],
    [
      'laboratorio-de-terraform',
      'Laboratório de Terraform',
      'Laboratório para estudar Terraform dentro da Codaqui.',
      'codaqui',
      'https://github.com/codaqui/terraform-organization',
    ],
    [
      'tutor',
      'Tutor',
      'Aplicação para explorar Python e conceitos do mundo de Desenvolvimento.',
      'codaqui',
      'https://github.com/codaqui/tutor',
    ],
    [
      'copilot-dashboard',
      'Copilot Dashboard',
      'Painel para visualizar e analisar dados de uso do GitHub Copilot.',
      'codaqui',
      'https://github.com/codaqui/copilot-dashboard',
    ],
    [
      'backstage-lab',
      'Backstage Lab',
      'Projeto para explorar o Backstage, a plataforma open source de developer portal da Spotify.',
      'codaqui',
      'https://github.com/codaqui/backstage',
    ],
    [
      'translate-talks',
      'Translate Talks',
      'Tradução em tempo real das talks de eventos para melhorar a acessibilidade para pessoas com deficiência auditiva.',
      'devparana',
      'https://github.com/DeveloperParana/translate-talks',
    ],
    [
      'sorteio-app',
      'Sorteio App',
      'Aplicação para realizar sorteios nos eventos e meetups das comunidades.',
      'devparana',
      'https://github.com/DeveloperParana/sorteio-app',
    ],
  ]),
  ...catalogEntries('program', 'active', 'programa', [
    [
      'codaqui-universitario',
      'Codaqui Universitário',
      'Conectamos instituições de ensino, embaixadores e participantes em encontros de tecnologia.',
      'codaqui',
      '/universitario',
    ],
    [
      'embaixadores-devparana',
      'Embaixadores do DevParaná',
      'O Projeto Embaixadores organiza o DevParaná em regiões do estado, garantindo que cada cidade tenha uma pessoa de referência.',
      'devparana',
      'https://devparana.org/embaixadores',
    ],
  ]),
  ...catalogEntries('campaign', 'finished', null, [
    [
      'tisocial-pascoa-2025',
      'Páscoa 2025: 632 Sorrisos',
      'Nossa primeira grande ação de 2025 foi um sucesso absoluto. Com o apoio da comunidade, conseguimos levar a magia da Páscoa para centenas de crianças.',
      'tisocial',
      'https://tisocial.org.br/blog/pascoa-2025',
      '2025-04-15',
    ],
    [
      'tisocial-level-up-careers-2025',
      'Level Up Careers: Educação e Tecnologia',
      'Um evento focado em impulsionar carreiras através do conhecimento técnico e networking.',
      'tisocial',
      'https://tisocial.org.br/blog/level-up-careers-2025',
      '2025-05-20',
    ],
    [
      'tisocial-batalha-contra-o-frio-2025',
      'A Batalha Contra o Frio',
      'Nossa maior campanha de arrecadação de agasalhos e mantimentos para o inverno de 2025.',
      'tisocial',
      'https://tisocial.org.br/blog/batalha-contra-o-frio-2025',
      '2025-07-10',
    ],
    [
      'tisocial-cestou-2025',
      'Campanha Cestou: Segurança Alimentar',
      'Focada em garantir o alimento na mesa de famílias em situação de vulnerabilidade.',
      'tisocial',
      'https://tisocial.org.br/blog/cestou-2025',
      '2025-07-25',
    ],
    [
      'tisocial-dia-mundial-limpeza-2025',
      'Dia Mundial da Limpeza: Sustentabilidade na Prática',
      'Em setembro, a T.I. Social se uniu ao movimento global pelo meio ambiente, realizando ações de plantio e conscientização sobre reciclagem.',
      'tisocial',
      'https://tisocial.org.br/blog/dia-mundial-limpeza-2025',
      '2025-09-20',
    ],
    [
      'tisocial-workshop-seguranca-digital-2025',
      'Workshop: Educação e Segurança Digital para Terceira Idade',
      'A inclusão digital não tem idade. Realizamos um workshop focado em segurança e uso consciente da tecnologia para idosos.',
      'tisocial',
      'https://tisocial.org.br/blog/workshop-seguranca-digital-2025',
      '2025-10-05',
    ],
    [
      'tisocial-dia-das-criancas-2025',
      'Dia das Crianças: Sorrisos que Transformam',
      'Celebramos o Dia das Crianças com uma ação especial focada em levar alegria e diversão para pequenos em situação de vulnerabilidade.',
      'tisocial',
      'https://tisocial.org.br/blog/dia-das-criancas-2025',
      '2025-10-11',
    ],
    [
      'tisocial-no-shave-november-2025',
      'No Shave November: Investindo na Generosidade',
      'Sob o mote "Economize no estilo e invista na generosidade", incentivamos nossa comunidade a converter pequenos gastos pessoais em doações para o Natal.',
      'tisocial',
      'https://tisocial.org.br/blog/no-shave-november-2025',
      '2025-11-30',
    ],
    [
      'tisocial-pet-fevereiro-2026',
      'Ação PET Fevereiro 2026: Impacto e Transparência',
      'Em fevereiro, nossos amigos de quatro patas foram o foco da nossa missão. Unimos forças com a comunidade para garantir cuidado e saúde para animais em situação de vulnerabilidade.',
      'tisocial',
      'https://tisocial.org.br/blog/pet-fevereiro-2026',
      '2026-02-15',
    ],
    [
      'tisocial-pascoa-2026',
      'Páscoa Solidária 2026: Missão Cumprida!',
      'Nossa campanha de Páscoa 2026 foi um sucesso absoluto! Graças à colaboração de todos, conseguimos levar doçura e alegria para centenas de pessoas.',
      'tisocial',
      'https://tisocial.org.br/blog/pascoa-2026',
      '2026-03-15',
    ],
  ]),
];
