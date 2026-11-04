<!-- AGENT-INDEX
purpose: ADR das diretorias e designations entregues na Fase 1a, incluindo vínculos, roles derivadas e autorização por escopo.
audience: AI agents, mantenedores e admins trabalhando em RBAC e governança.
status: Implementado na Fase 1a (2026-11-02); horas e demais subsistemas permanecem para fases futuras.
sections:
  - Contexto
  - Decisão
  - Modelo entregue
  - APIs e autorização
  - Consequências e limites
related-docs:
  - ../modules/events/ROLES.md — mapa de roles globais, derivadas e staff de eventos
  - ../../AGENTS.md — proxy, paginação e padrões do monorepo
  - ../plans/codaqui-1-0/rbac.md — desenho completo, incluindo fases ainda não implementadas
agent-protocol:
  - member_designations é a única fonte dos vínculos novos; não criar tabelas ou colunas paralelas.
  - Não declarar hour_ledger, mentoria, projetos de extensão ou Codaqui Universitário como implementados.
-->

# ADR 006 — Diretorias e Designations

- **Data da decisão:** 2026-11-02
- **Status:** Implementado (Fase 1a)
- **Escopo:** `backend/src/designations/`, `backend/src/directorates/`, migrations 026–027, `/admin/diretorias` e `useMyDesignations`

## Contexto

A associação precisava representar vínculos organizacionais sem transformar cada relação em uma role global ou em uma coluna específica. Diretorias, comunidades e futuros domínios compartilham as mesmas necessidades: indicar quem ocupa uma função, qual é o destino do vínculo, seu estado e quem o concedeu. Também era necessário impedir que roles calculadas a partir desses vínculos fossem editadas manualmente.

## Decisão

Adotar `member_designations` como **fonte única dos vínculos novos**. Uma designation relaciona um membro a um `targetType` com `targetId` e/ou `targetKey`, uma função e um status (`pending`, `active`, `ended` ou `removed`). Diretorias guardam apenas seus próprios dados; não existem `directorMemberId`, `directorate_members` ou estruturas equivalentes.

As roles organizacionais são derivadas das designations ativas em transação com grant, confirmação e revogação. A edição administrativa de membros rejeita qualquer adição ou remoção manual dessas roles. O JWT continua carregando as roles atuais do membro a cada request, sem exigir novo login após uma mudança.

## Modelo entregue

A migration 026 cria índices de consulta, unicidade de vínculos ativos (inclusive com `targetKey` nulo) e restrições para funções que admitem somente um titular ativo por destino. Grant, confirmação e revogação registram auditoria de governo. Consultas de autorização usam cache de 60 segundos, invalidado nas escritas.

Regras de derivação implementadas:

| Designation ativa | Roles derivadas |
|---|---|
| `director @ directorate` | `diretor`, `voluntario` |
| `volunteer @ directorate` | `voluntario` |
| `mentor @ program(targetKey=mentoria)` ou `mentor @ extension_project` | `mentor` |
| `manager @ program(targetKey=universitario)` | `gestor_universitario` |

A tabela aceita os target types e funções previstos pelo contrato RBAC, mas isso **não** significa que todos os módulos correspondentes existam. Na Fase 1a, diretorias e o vínculo `responsible @ community` têm fluxos de uso entregues; mentoria, projetos de extensão e gestão universitária permanecem em design.

A migration 027 cria `directorates` com `id`, `slug`, `name`, `description`, `isActive`, `createdAt` e `updatedAt`. O slug é único.

## APIs e autorização

| Endpoint | Acesso e comportamento |
|---|---|
| `GET /designations/me` | Membro autenticado; lista somente suas designations ativas. |
| `POST /designations` | Admin; concede vínculo, por padrão já ativo, e sincroniza roles derivadas. |
| `POST /designations/:id/confirm` | Admin; confirma `pending → active` e sincroniza roles. |
| `POST /designations/:id/revoke` | Admin; marca como removida, encerra o vínculo e recalcula roles. |
| `GET /directorates/public` | Público; lista somente diretorias ativas. |
| `GET /directorates/manage` | Admin ou `diretor`; busca server-side e paginação padrão (`limit=50`, cap 100). |
| `POST /directorates` | Admin; cria diretoria. |
| `PATCH /directorates/:id` | Admin ou diretor com designation ativa **para a mesma diretoria**. O guard e o service verificam o escopo. |

O frontend consome `GET /designations/me` por `useMyDesignations`, atualiza o estado após escritas e usa as designations para mostrar navegação contextual. O proxy same-origin recebeu apenas `/designations/` e `/directorates/`; páginas `/admin/*` continuam fora da allow-list.

## Consequências e limites

- Uma única representação atende vínculos atuais e futuros, com auditoria e revogação sem edição manual de roles.
- Autorização por designation precisa ser verificada no backend; esconder navegação no frontend não é controle de acesso.
- Roles manuais continuam coexistindo com as derivadas. A sincronização preserva as manuais e altera somente `diretor`, `voluntario`, `mentor` e `gestor_universitario`.
- Não existe `hour_ledger`, lançamento/aprovação de horas ou certificado de horas nesta fase. Eventos e check-in não alimentam nenhuma ledger de horas.
- Não houve migração de `event_organizer_ownership` para designations; o modelo de ownership de eventos permanece inalterado.
