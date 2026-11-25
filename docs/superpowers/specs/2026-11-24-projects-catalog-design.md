<!-- AGENT-INDEX
purpose: Registrar a arquitetura aprovada para o catálogo de projetos no backend e as correções editoriais associadas.
audience: Mantenedores, presidência, designers e AI agents.
status: Aprovado para planejamento e implementação na release 1.14.0, após revisão solicitando backend para todas as categorias.
sections:
  - Intenção
  - Escopo
  - Abordagens
  - Modelo e migration 055
  - Regras por categoria
  - Frontend e correções editoriais
  - Verificação e rollout
related-docs:
  - ../adrs/008-entities-extension-projects.md — modelo atual de extensão.
  - ../adrs/015-codaqui-universitario.md — jornada existente do Universitário.
  - PRODUCT.md — posicionamento da Codaqui como associação de comunidades.
agent-protocol:
  - Não criar tabela paralela nem apagar histórico; preservar IDs, URLs e conteúdo canônico.
  - Testar migration up/down/up em dump isolado antes de publicar; nenhum deploy sem autorização explícita.
-->

# Catálogo de projetos no backend

## Intenção

Transformar `/projetos` em uma base de iniciativas com **Programas**, **Extensão**, **Campanhas** e **Open Source**, alimentada pelo backend e sem duplicar páginas ou modelos existentes. Campanhas podem pertencer a qualquer comunidade, não somente à T.I. Social.

Universitário aparece como programa e leva a `/universitario`; Embaixadores leva à página canônica `https://devparana.org/embaixadores`. Não há mudança de URLs publicadas ou identidade visual.

Também corrigir referências editoriais: remover media kit, apresentar certificados das trilhas como desenvolvimento interno e atualizar o link do GitHub Starter.

## Escopo

- Migration 055 e contratos públicos para as quatro categorias.
- Importação dos conteúdos atuais de open source, programas e campanhas.
- Regras para impedir inscrições, horas e certificados fora de Extensão.
- Catálogo frontend consumindo o snapshot do backend.
- Release 1.14.0, sem mudança no admin visual atual de Extensão.

Não inclui renomear `extension_projects`, migrar FKs para outra tabela, um novo editor genérico no admin ou alteração de permissões.

## Abordagens

1. **Estender `extension_projects` — aprovada.** Acrescenta `category` e `canonicalUrl`, preservando IDs, participantes, horas, certificados e designations.
2. **Nova tabela genérica — descartada.** Exigiria migração de IDs/FKs e ampliaria risco sem benefício proporcional.
3. **Base híbrida — substituída após revisão.** Era menor, mas deixaria Campanhas presas ao conteúdo estático e não atenderia a qualquer comunidade no backend.

## Modelo e migration 055

Adicionar:

- `category`: varchar com `program | extension | campaign | open_source`, default `extension` e constraint de valores.
- `canonicalUrl`: texto opcional para a página original. Extensão mantém `/projetos/<slug>` quando não houver URL original.

O backfill define todos os registros atuais como `extension`, sem alterar status, visibilidade ou relações.

Seeds, com `ON CONFLICT` por slug e sem sobrescrever registros editados:

- **11 open source:** os itens atuais de `frontend/src/data/projects.ts`, com seus links reais e descrições.
- **2 programas:** Codaqui Universitário e Embaixadores do DevParaná.
- **10 campanhas:** os posts atuais da T.I. Social marcados com `campanhas`, com slug prefixado por `tisocial-`, data e `canonicalUrl` para o post canônico. Campanhas entram como `finished`; Programas e Open Source como `active`.

As entidades Codaqui, DevParaná e T.I. Social são criadas somente se ausentes. O seed usa o membro `endersonmenezes` como responsável técnico da importação e falha explicitamente se ele não existir; não se atribui o conteúdo a um ator arbitrário. Repositórios pessoais mantêm seus links; a entidade de catálogo representa a responsabilidade institucional, não a propriedade do repositório.

## Regras por categoria

- **Extensão:** somente projetos `active` continuam públicos. Lifecycle, participação, horas, certificados e o admin atual permanecem restritos a essa categoria.
- **Programas, Campanhas e Open Source:** registros `active` e `finished` podem ser públicos, respeitando `isPublic`. Não oferecem inscrição, horas ou certificados.
- A criação genérica por API aceita categorias além de Extensão com validação mínima coerente, sem exigir mentor, ODS ou orçamento. O admin visual existente continua editando somente Extensão.
- `canonicalUrl` aceita caminho interno iniciado por `/` ou URL HTTPS; esquemas inseguros são rejeitados.
- `kind` permanece a forma da atividade e não é usado como categoria.

## Frontend e correções editoriais

A página usa o snapshot de `projects` para todas as categorias, apresentando Programas, Extensão, Campanhas e Open Source nessa ordem. Cards usam `canonicalUrl` quando presente; Extensão sem URL original continua para o detalhe interno. Seções sem dados são omitidas.

O detalhe interno de `/projetos/<slug>` oferece o link original quando houver e só apresenta participação para Extensão ativa. Open Source e Campanhas nunca mostram o formulário de inscrição.

Correções editoriais:

- Remover a linha de CTA para `devpr.org/media-kit` em `blog/2023-01-05-codaqui-na-conferencia-do-devpr-2023.md`.
- Substituir os links de `certificado-python` e `certificado-javascript` em `blog/2022-10-14-hello-world.md` por “Certificados Codaqui para as trilhas: em desenvolvimento no sistema interno”.
- Atualizar `trilhas/github/page-8.md` para `https://github.com/classroom-resources/github-starter-course`.

Atualizar ADR/documentação viva e o follow-up de links. Universitário deixa de ser órfão; os demais itens permanecem abertos.

## Verificação e rollout

- Testes RED→GREEN para categoria, URLs, visibilidade, proteção das operações de Extensão e conteúdo dos seeds.
- Migration 055 testada up/down/up em dump isolado, preservando contagens e relações existentes.
- Auditoria dos links alterados e do catálogo em desktop/mobile, claro e escuro.
- Build backend/frontend, suítes completas e gates multi-tenant.
- Rollout: merge autorizado → publicar backend/migration 055 → redeploy no Coolify → sync de projetos → publicar frontend → validar catálogo real.
