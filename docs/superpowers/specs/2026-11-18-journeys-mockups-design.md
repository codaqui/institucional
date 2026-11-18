<!-- AGENT-INDEX
purpose: Design ratificado das Fases 10.1–10.3 — aplicar os mockups de jornadas com dados reais, completar transparência/perfil e endurecer o admin.
audience: Presidência, mantenedores, implementadores e revisores.
status: Aprovado para planejamento e implementação em develop; nenhuma parte implementada por este documento.
sections:
  - Intenção e abordagem
  - Inventário dos mockups
  - Fase 10.1 — Home e navegação
  - Fase 10.2 — Transparência e perfil
  - Fase 10.3 — Robustez administrativa
  - Regras transversais e não objetivos
  - Verificação, rollout e documentação
related-docs:
  - ../../mockups/home-jornadas.html — referência principal da Home.
  - ../../mockups/comunidade-transparencia-proposta.html — referência da transparência whitelabel.
  - ../../mockups/perfil-proposta.html — referência do perfil público.
  - ../../mockups/admin-proposta.html — referência do padrão administrativo.
  - ../../plans/frontend-jornadas/README.md — inventário de jornadas e ondas.
  - ../../plans/pos-1-0/README.md — ordenação do roadmap.
agent-protocol:
  - Fidelidade ao mockup é visual, semântica e de jornada; números, pessoas, links e atividades ilustrativos nunca viram dados reais.
  - Não prometer horas comunitárias totais nem atas por comunidade enquanto o modelo não tiver vínculo completo.
  - Implementar em develop na ordem 10.1 → 10.2 → 10.3, com TDD e gates por entrega; uma única release minor ao concluir o conjunto.
-->

# Fases 10.1–10.3 — Jornadas, mockups e robustez operacional

## Intenção e abordagem

A Codaqui deve ser apresentada como uma associação de comunidades, e não apenas como um portal de estudo e doação. A Home, a navegação, os sites das comunidades e os perfis públicos devem conectar quatro visões: **Aprender, Comunidades, Apoiar e Acompanhar/auditar**. O admin deve sustentar essas jornadas sem inconsistências de API, paginação ou carregamento.

A abordagem escolhida é dividir o trabalho em três entregas sequenciais na mesma linha `develop`:

1. **10.1:** mudança pública visível com os dados e contratos já existentes.
2. **10.2:** novas projeções públicas restritas ao que o banco consegue atribuir com segurança.
3. **10.3:** correções administrativas e de robustez, sem alterar regras financeiras.

A alternativa de implementar todos os mockups em uma única etapa foi descartada porque misturaria frontend, agregações e privacidade, dificultando revisão e rollback. A alternativa de copiar literalmente os HTMLs também foi descartada: eles contêm dados fictícios, rotas ilustrativas e estilos próprios que não substituem os componentes e tokens do app.

O conjunto terá uma única release minor compartilhada, prevista como **1.8.0**, sem migration. Fases e etapas são rótulos organizacionais, não tags independentes.

## Inventário dos mockups

- `main-proposta.html` é uma referência histórica da Home. Não será implementado separadamente nem mantido como segunda direção concorrente.
- `home-jornadas.html` é a referência vigente da Home e da arquitetura de navegação.
- `comunidade-transparencia-proposta.html` orienta a ordem atividades → pessoas → finanças e o vínculo associativo dos tenants. A seção de atas não será fabricada.
- `perfil-proposta.html` orienta designations legíveis, comunidades e CTA de mentoria. A carteirinha e o QR atuais são preservados.
- `membro-proposta.html` e a taxonomia de `admin-proposta.html` foram majoritariamente entregues na Fase 9. Contadores e painéis agregados continuam fora. O padrão de tabela do admin permanece como referência da 10.3.

Os mockups e seus testes de qualidade continuam versionados como referência. A implementação usa Astro, React/MUI, Tailwind e tokens `--cq-*`; não copia CSS solto nem adiciona um segundo design system.

## Fase 10.1 — Home e navegação por jornadas

### Home

Substituir a composição atual de `frontend/src/pages/index.astro` e seus componentes exclusivos por seções equivalentes à referência:

1. Hero com um único `h1`: “Uma associação que reúne comunidades de tecnologia”, explicação do guarda-chuva institucional e CTAs para comunidades, integração e prestação de contas.
2. Comunidades integradas/parceiras a partir de `loadCommunitiesIndex()`, usando nome, logo, nível, selo e links reais. Não exibir métricas fictícias nos cartões.
3. “Como o guarda-chuva funciona”, com conteúdo institucional estático e terminologia de Associação.
4. Atividades reais selecionadas de snapshots/collections existentes. Eventos usam `loadEventsIndex()` e os helpers canônicos de rota/data. Conteúdo de blog e C4P só entra se houver item público válido e link real; não há cards placeholders.
5. Formas de participação para aprender, apoiar, voluntariar e patrocinar, somente com destinos existentes ou implementados na mesma etapa.
6. Links de transparência, insights e dados abertos. A tabela comparativa e os KPIs agregados ficam fora até existir projeção confiável.

A seção de números sociais existente pode permanecer somente se continuar alimentada pelo snapshot real e não duplicar a nova mensagem. Componentes antigos que deixarem de ser usados serão removidos junto com referências e testes obsoletos; componentes compartilhados com outras rotas serão preservados.

### Navegação e footer

Reorganizar o conteúdo do `SiteHeader` e do drawer em torno de Comunidades, Atividades, Transparência, Aprender e Apoiar, com CTA “Integrar minha comunidade”. Manter o mecanismo de menu e autenticação existentes; esta fase não reescreve popover, hover-intent ou focus trap.

- Desktop e mobile consomem a mesma estrutura de dados de links.
- `aria-current="page"` e indicador visual não somente por cor identificam a seção atual, inclusive quando a rota atual é filha de uma seção.
- Busca, tema e autenticação permanecem disponíveis.
- Footer ampliado preserva acesso a Blog, Projetos, Patrocinadores, C4P, Contato, Sobre e Trilhas quando esses links saírem do nível principal.
- Nenhuma URL existente muda; `diff-urls` continua verde.

## Fase 10.2 — Transparência das comunidades e perfil público

### Projeção pública de transparência

Adicionar `GET /communities/public/:slug/transparency?year=<opcional>`, sem autenticação e dentro do prefixo `/communities/` já permitido pelo proxy.

A resposta conterá somente:

- comunidade `{slug,name}` e responsible público já exposto pelo registro;
- anos disponíveis e período efetivo;
- métricas de eventos gerenciados/publicados e eventos externos ativados vinculados por `communityProjectKey=slug`;
- participações confirmadas e certificados concedidos nesses eventos;
- horas aprovadas **exclusivamente de `event_checkin`** atribuíveis a esses eventos, filtrando membros cuja visibilidade pública de horas esteja desativada;
- listas curtas de próximas e últimas atividades com título, tipo e data, sem participantes, e-mails, notas, atores ou IDs internos.

O rótulo da UI será “horas de voluntariado em eventos”, nunca “total de horas da comunidade”. Participações contam registros confirmados, não pessoas únicas. Certificados exigem concessão e inscrição confirmada. Rascunhos/cancelados não entram. O filtro anual usa o início do evento para todas as métricas, inclusive horas; assim, horas lançadas/aprobadas tardiamente continuam atribuídas ao ano em que a atividade ocorreu e a soma dos anos fecha com “Desde o início”. Os anos disponíveis derivam dos eventos elegíveis. O payload declara o ano efetivo. Consultas agregam no PostgreSQL, sem N+1 por atividade ou membro.

Não haverá atas comunitárias, horas de mentoria/projetos/diretorias nem total ecológico de voluntariado: o modelo atual não oferece vínculo comunitário completo. Finanças continuam na conta `projectKey` e nos endpoints de ledger existentes; a nova projeção não duplica nem altera o ledger.

### Experiência whitelabel

Reorganizar `CommunityTransparenciaPage.astro` e `CommunityTransparencyIsland` para:

- faixa permanente “comunidade integrada à Associação Codaqui” com CNPJ e links institucionais;
- hero de transparência com atividades, responsáveis e recursos;
- métricas e atividades antes das finanças;
- responsáveis reais, com link `/@handle` somente para perfil público válido;
- finanças, movimentações e CTA de apoio existentes preservados;
- estados independentes de carregamento/erro para atividades e finanças, com retry sem apagar a outra seção;
- período selecionável somente entre “Desde o início” e anos retornados pela API.

O componente continua compartilhado entre portal e tenants, usando branding de `community.config.ts`. Sem dados de atividade, a seção mostra empty state explicativo; não inventa valores.

### Perfil público e mentoria

Adicionar `GET /members/by-handle/:handle/engagement` para projecções públicas adicionais sem ampliar o payload de todos os diretórios:

- designations ativas e vigentes somente quando `profileVisibility.designations` permitir;
- vínculos públicos resolvíveis de comunidades ativas e do programa de mentoria, também derivados de designations e, portanto, ocultos junto com as pills quando `profileVisibility.designations=false`;
- nomes e hrefs públicos, sem `appointedById`, `confirmedById`, notas ou IDs internos de designation;
- perfil público de mentor somente com perfil ativo, membro ativo, designation `mentor @ program('mentoria')` vigente e a mesma visibilidade de designations habilitada.

Desativar designations no perfil não remove o mentor do diretório público já existente, mas remove pills, comunidades e CTA contextual do perfil individual. Não será criada nova chave de visibilidade nem migration.

Vínculos de eventos, projetos, entidades, campanhas/C4P, IES, empresas e diretorias ficam fora desta entrega, inclusive como pills, se não houver projeção pública segura reutilizável. A omissão é preferível a expor vínculos privados.

Uma ilha no perfil `/@handle` consumirá a projeção sem bloquear a carteirinha estática. Ela renderizará pills legíveis, comunidades e “Agendar mentoria”. Erro de engagement não derruba as demais seções públicas.

A página pública de mentoria aceitará `?mentor=<id público do perfil ou handle>`, selecionará somente um mentor presente no snapshot ativo e carregará seus horários pelo fluxo existente. Valor desconhecido não quebra a página nem cria mentor. O CTA fecha o caminho perfil → mentor selecionado → horários → solicitação.

## Fase 10.3 — Robustez administrativa

### Conversão empresarial completa

- Adicionar consulta admin das empresas pelas quais o membro selecionado é responsável, sem carregar/filtrar apenas a primeira página de `/companies/admin/list`.
- A resposta contém somente os campos já necessários ao painel de conversão e não altera vínculos Stripe.
- A pesquisa de assinaturas Stripe seguirá a paginação nativa até esgotar os resultados. Um limite defensivo de 1.000 registros evita loop remoto ilimitado; atingir esse limite produz erro explícito, nunca omissão silenciosa.
- Manter filtro pessoal/mensal/ativo e a idempotência da conversão inalterados.
- Exibir `currentPeriodEnd` com `Intl.DateTimeFormat('pt-BR')`, preservando ISO somente no contrato.

### API, paginação e feedback

- Remover usos produtivos de `API_URL` cru nas ilhas admin restantes, usando `resolveApiUrl(import.meta.env.SITE)` e `authFetch` quando a rota exigir sessão.
- Migrar empresas, eventos, e-mails, pedidos e o `DataTable` compartilhado para `PaginationControls` quando possuírem paginação real. Não criar paginação apenas visual nem alterar envelopes sem necessidade.
- Preservar página, filtros e seleção válidos ao recarregar; página inválida após mudança de filtro retorna a um estado seguro.
- Adicionar skeleton e “Tentar novamente” nas tabelas tocadas, com mensagens de erro reais e sem falso sucesso.
- Não incluir contadores de sidebar, dashboard agregado ou alterações de saldo/taxas/conversão financeira.

## Regras transversais e não objetivos

- Dados de mockup nunca são fixtures de produção, conteúdo público ou evidência de rollout.
- Somente dados públicos existentes ou contratos descritos acima; nenhum e-mail, nota, token, ator interno ou PII de participante.
- Preservar Astro estático, multi-tenant por build, proxy same-origin, tokens e temas claro/escuro.
- Imagens dimensionadas e decorativas com `alt=""`; landmarks, headings, nomes acessíveis, foco visível e navegação por teclado testados.
- Layouts adaptam-se ao contêiner/viewport sem overflow em 360 px; tipografia fluida usa limites legíveis e mídia reserva espaço.
- Não adicionar dependência para navegação, agregações, formatação de data ou componentes visuais.
- Não implementar Real Network, votação eletrônica, hub unificado de eventos, Camada 3 do sync ou painéis de pendências.
- Não alterar snapshots gerados manualmente nem conteúdo canônico em `src-tenants`.

## Verificação, rollout e documentação

Cada etapa começa com testes que falham pelo comportamento ausente:

- **10.1:** Vitest para seleção de dados/links/aria-current e smoke do HTML estático; inspeção visual da Home e header/footer em 360/768/1280 px, dois temas e teclado.
- **10.2:** Jest para agregações, filtro anual, ausência de PII, visibilidade e designation expirada; Vitest para estados independentes e deep link de mentoria. Jornada PostgreSQL em dump isolado com fixtures sintéticas: eventos próprios/externos → inscrições → presença/certificado/horas → projeção por comunidade e privacidade do perfil → CTA de mentoria.
- **10.3:** Jest para empresas por membro e múltiplas páginas Stripe; Vitest para erro de limite, data formatada, resolução same-origin, paginação/retry/skeleton. Jornada isolada de conversão com repetição `already_converted`, sem executar conversão real.

Gates finais sobre a árvore entregue:

```bash
cd backend && npm run build && npx jest --silent
make astro-verify
make astro-verify-tenants
npm run test:scripts
```

Ao concluir o conjunto: alinhar frontend/backend e lockfiles em 1.8.0, atualizar `CHANGELOG.md`, roadmap, índices, documentação de comunidades/mentoria e ADRs existentes cujos contratos públicos mudarem. Não criar ADR nem migration se não houver mudança estrutural adicional.

Rollout: backend antes do frontend para as novas projeções; nenhum sync novo é necessário porque transparência e engagement consultam APIs públicas em runtime. Validar uma comunidade e um perfil reais sem executar conversões ou outras mutações financeiras. Dados incompletos permanecem declarados na UI e na documentação, não preenchidos com estimativas.
