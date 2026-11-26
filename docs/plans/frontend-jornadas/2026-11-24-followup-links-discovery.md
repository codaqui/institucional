<!-- AGENT-INDEX
purpose: Registrar os follow-ups aprovados da auditoria de links e descoberta realizada em 2026-11-24.
audience: Mantenedores, presidência e AI agents planejando a próxima versão após 1.13.0.
status: Em implementação na 1.14.0; referências editoriais e entrada de Universitário resolvidas, demais itens permanecem abertos.
sections:
  - Contexto e evidências
  - Links externos quebrados
  - Páginas públicas órfãs
  - Robustez e verificações pendentes
  - Critérios de aceite
  - Itens descartados
related-docs:
  - README.md — índice de planos ativos.
  - ../../CHANGELOG.md — release 1.14.0 e classificação das versões.
agent-protocol:
  - Revalidar status e URLs antes de concluir os itens restantes; não reabrir correções já verificadas.
  - Preservar slugs publicados e conteúdo canônico; corrigir links em blog/ e trilhas/, nunca nas cópias geradas.
-->

# Follow-up de links, descoberta e robustez

## Contexto e evidências

A auditoria de 2026-11-24 percorreu 705 páginas geradas e 38.742 ocorrências de links entre portal e tenants, além de 736 destinos externos únicos. Não foram encontrados links internos quebrados nem redirects sem destino. Foram confirmados três links externos quebrados e nove páginas públicas órfãs no portal, com três equivalentes no tenant da T.I. Social.

## Links externos quebrados

1. **Resolvido na 1.14.0:** a linha de CTA para `https://devpr.org/media-kit` foi removida de `blog/2023-01-05-codaqui-na-conferencia-do-devpr-2023.md:35`.
2. **Resolvido na 1.14.0:** os links de `certificado-python` e `certificado-javascript` foram substituídos pela indicação de desenvolvimento no sistema interno em `blog/2022-10-14-hello-world.md`. O repositório Python permanece privado e não recebe link público.
3. **Resolvido na 1.14.0:** `trilhas/github/page-8.md` passou a usar `https://github.com/classroom-resources/github-starter-course`, confirmado ativo.

## Páginas públicas órfãs

Todas estão no sitemap e respondem, mas não recebem referências no HTML gerado. Definir e testar entradas nas jornadas correspondentes:

- **Resolvido na 1.14.0:** `/universitario` entra como Programa na base `/projetos`, com a migration 055 e o sync de projetos.
- `/termos-de-compra` e `/sobre/pais-responsaveis`: avaliar links no rodapé legal/de participação.
- `/blog/authors` e `/blog/category`: ligar os índices gerais a partir da navegação do blog, sem remover os links para autores/categorias específicas.
- `/comunidades/tisocial/blog/archive`, `/authors` e `/tags`: ligar os três índices no portal; aplicar o mesmo vínculo às rotas `/blog/archive`, `/blog/authors` e `/blog/tags` no domínio da T.I. Social.
- `/design-system`: decidir se o brand book é público, ganhando entrada institucional, ou material interno, caso em que deve deixar o sitemap e receber `noindex`.

`/membros/perfil` não entra no trabalho: é fallback intencional para perfis dinâmicos.

## Robustez e verificações pendentes

- Repetir a verificação dos 56 destinos externos inconclusivos com navegador e limites por host. Eles apresentaram 403, 429, 999, timeout ou falha de rede e não devem ser tratados como quebrados sem confirmação.
- `/universitario` retornou HTTP 500 uma vez e HTTP 200 em quatro tentativas seguintes. Monitorar; se o erro voltar, investigar logs do Pages/backend antes de propor correção.
- `ProjectMentorFields > debounces member search by 300 ms` falhou intermitentemente na CI quando a digitação excedeu o debounce sob CPU lenta. Reescrever a sincronização do teste sem alterar o comportamento do componente nem ampliar timeouts arbitrariamente.
- Manter um gate de links internos e páginas órfãs para evitar regressão, considerando rotas dinâmicas, redirects, `noindex` e fallbacks intencionais para reduzir falsos positivos.

## Critérios de aceite

- Os três destinos confirmados como quebrados deixam de aparecer na auditoria ou respondem sem 404/410.
- Toda página pública listada recebe ao menos uma entrada interna coerente, ou tem sua intenção de acesso direto/noindex documentada e testada.
- As três rotas da T.I. Social ficam descobríveis tanto no portal quanto no domínio próprio.
- A auditoria repete 200 nos links internos e não apresenta redirects sem destino.
- O teste de debounce permanece determinístico sob CPU lenta e toda a suíte de frontend e os gates multi-tenant passam.

## Itens descartados

- Não corrigir o suposto rodapé compartilhado dos tenants apontado na revisão da 1.12.1: a inspeção dos builds confirmou rodapés próprios e nenhum link interno quebrado. A observação anterior era um falso positivo.
