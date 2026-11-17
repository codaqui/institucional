<!-- AGENT-INDEX
purpose: Desenho da Fase 8b.3 — conversão administrativa de assinatura pessoal em apoio empresarial sem nova cobrança ou perda de histórico.
audience: AI agents, mantenedores, diretoria e revisores financeiros
status: ratificada para implementação em develop
sections:
  - Contexto e evidências
  - Objetivos e limites
  - Abordagens
  - Modelo, fluxo e recuperação
  - API, admin e auditoria
  - Verificação e rollout
related-docs:
  - ../../adrs/003-club-business-pj.md — empresa, CNPJ, wallet e assinatura
  - ../../adrs/010-business-tiers.md — status/tier e selo
  - ../superpowers/specs/2026-11-17-open-source-extension-design.md — fase anterior
agent-protocol: Não implementar antes de ratificação; nenhuma conversão real, refund ou cancelamento durante testes.
-->

# Fase 8b.3 — Assinatura pessoal para apoio empresarial

## Contexto e evidências

O Clube pessoal e o Clube Business compartilham Stripe, mas diferem em empresa, CNPJ, wallet e metadados de assinatura. `company.stripeCustomerId` e `stripeSubscriptionId` são únicos; o dump isolado preservou cinco empresas e três vínculos de assinatura sem duplicidade. A leitura MCP do Stripe redige metadados, portanto nenhum caso pessoal específico é presumido nesta spec.

Hoje, `invoice.payment_succeeded` lê `entityType`, `companyId` e `memberId` da assinatura para decidir ledger e crédito. Assim, atualizar os metadados da mesma assinatura muda somente cobranças futuras, preservando ID, customer, faturas, preço, período e histórico. Criar um checkout novo criaria risco de dupla cobrança e quebra de continuidade.

## Objetivos e limites

### Objetivos

- Admin converte uma assinatura pessoal ativa para uma empresa existente ou criada no fluxo.
- Admin revisa/edita CNPJ, nome legal, nome fantasia, logo e website da empresa antes da conversão, com salvamento separado para empresas existentes.
- Preservar o mesmo `subscriptionId`, histórico Stripe, ledger, invoices e wallet pessoal.
- Aplicar empresa e wallet empresarial somente aos eventos futuros.
- Tornar a operação idempotente, recuperável após falhas e auditada.
- Exibir candidatos e confirmação explícita sem expor segredos ou dados Stripe desnecessários.

### Não objetivos e anti-objetivos

- Não criar novo checkout/assinatura, cancelar, reembolsar ou alterar valor/vencimento.
- Não reclassificar transações antigas, gerar crédito retroativo ou transferir SortCoins pessoais.
- Não alterar tier, selo, validade ou visibilidade pública automaticamente além do status necessário da empresa.
- Não converter assinaturas canceladas, `past_due`, de outro membro ou já pertencentes a outra empresa.
- Não usar dados reais em fixtures/documentação nem executar conversão real durante a implementação.
- Não alterar P6, P12, CNPq ou outros módulos.
- Não fazer upload de logo; aceitar somente URL HTTPS e preservar a regra de storage externo.

## Abordagens

- **Escolhida — atualizar a mesma assinatura + registro de conversão:** preserva cobrança e histórico e permite recuperação entre Stripe e banco.
- **Novo checkout empresarial e cancelamento do pessoal:** duas assinaturas durante a transição, mais risco de cobrança dupla e efeitos externos. Rejeitada.
- **Somente editar `companies.stripeSubscriptionId`:** sem metadados, a próxima invoice continuaria pessoal; sem registro de conversão, recuperação fica ambígua. Rejeitada.

## Modelo, fluxo e recuperação

### Migration 052

Criar `company_subscription_conversions` com:

- UUID interno;
- `stripeSubscriptionId` único;
- `memberId`, `companyId` e `requestedById`;
- `status: pending | completed`;
- timestamps de criação, atualização e conclusão.

Não armazenar e-mail, nome, token, customer ou metadados completos. A unique da assinatura e um lock transacional por `stripeSubscriptionId` impedem duas conversões simultâneas. Registros `pending` podem ser retomados; `completed` retorna o mesmo resultado sem nova escrita Stripe.

### Fluxo

1. Admin seleciona membro e uma assinatura pessoal ativa.
2. O backend lê a assinatura atual e exige `status='active'`, recorrência mensal, `metadata.memberId=memberId` e ausência de `entityType='business'`. Assinatura anual é recusada sem escrita, pois o Clube Business atual é mensal.
3. A empresa existente deve ter o membro como responsável e estar sem assinatura ou já vinculada à mesma. Admin pode revisar CNPJ, nome legal, nome fantasia, logo e website e salvar esses dados em ação separada antes da conversão, sem efeito em Stripe ou visibilidade. Empresa nova usa os mesmos campos, CNPJ válido/único e responsável, seguindo o cadastro atual.
4. Uma transação cria/reutiliza a conversão e aplica lock por assinatura. Se já `completed`, retorna `already_converted`.
5. Fora da transação, atualizar somente os metadados necessários: `entityType='business'`, `companyId`, `memberId` e `isSubscription='true'`; os demais são preservados pelo merge do Stripe.
6. Vincular customer/subscription à empresa, persistir o preço atual e criar a wallet se ausente. Empresa nova permanece `pending` e exige ativação manual posterior; empresa existente preserva seu status atual. A conversão não acende vitrine, selo ou badge de uma empresa nova. Não há crédito retroativo.
7. Marcar a conversão `completed` e auditar antes/depois.

Se Stripe falhar, a conversão permanece `pending` e nenhuma confirmação é exibida. Se Stripe concluir e o banco falhar, a repetição reconhece os metadados/empresa já convertidos e conclui somente o trabalho ausente. Nenhuma tentativa cria cobrança ou altera invoices.

## API, admin e auditoria

### Consulta de candidatos

`GET /companies/admin/personal-subscriptions?memberId=<uuid>`, somente admin, usa busca Stripe por status/memberId e retorna somente:

```ts
{
  id: string;
  amountCents: number;
  interval: 'month'|'year'|null;
  currentPeriodEnd: string | null;
}
```

Assinaturas já empresariais, anuais ou de outro membro não entram. O UUID é validado e usado na query sem interpolação insegura. O período é lido do campo atualmente disponível na assinatura ou do primeiro item, sem exigir forma legada.

### Conversão

`POST /companies/admin/subscription-conversions`, somente admin, recebe `memberId`, `subscriptionId`, `companyId` opcional e, para empresa nova, os campos `name`, `cnpj`, `tradeName`, `logoUrl` e `websiteUrl`. Exatamente um dos caminhos deve ser usado. A resposta contém `conversionId`, `companyId`, `subscriptionId` e `status: converted|already_converted`, sem segredos.

### Perfil da empresa pelo admin

`PATCH /companies/:id` reutiliza `UpdateCompanyDto` para nome legal, nome fantasia, logo e website. O responsável atual mantém seu acesso; admin passa a editar esses campos pelo mesmo contrato. CNPJ não muda nesta edição para não criar uma segunda operação de identidade. Logo e website exigem HTTPS e não há upload.

A edição usa transação com lock da empresa e **update parcial somente dos campos enviados**, evitando sobrescrever vínculos Stripe durante uma conversão concorrente. A auditoria contém antes/depois e a ação é `company.profile_updated`, classificada como governo. Não altera assinatura, status, tier, selo ou visibilidade. No formulário de conversão, **Salvar dados da empresa** é separado de **Converter assinatura**; edição pendente não pode disparar conversão acidental.

Um helper compartilhado valida logo/website com `new URL` e protocolo HTTPS, sem reutilizar a allowlist de comprovantes. O mesmo helper é aplicado ao cadastro, edição e criação durante conversão, validando somente os campos presentes. Não há upload nem gravação de binário.

A UI fica em `/admin/empresas`, nova aba **Converter assinatura**, somente admin. Busca membro por `/mentorship/member-options`, lista candidatos mensais, permite selecionar empresa do membro ou cadastrar nova e exige confirmação de que a mesma assinatura será mantida. Para empresa existente, admin revisa nome legal, nome fantasia, logo e website e salva separadamente antes de converter; empresa nova preenche também CNPJ. O formulário informa que empresa nova permanece pendente até ativação manual. Repetição mostra `already_converted`, sem duplicar empresa ou alterar cobrança.

Adicionar `AuditAction.COMPANY_SUBSCRIPTION_CONVERTED = 'company.subscription_converted'`, classificado como governo, com ator, empresa, assinatura e membro, sem PII adicional. A operação não chama o ledger diretamente.

## Verificação e rollout

- Migration 052 testada down/up em dump isolado, preservando empresas e constraints existentes.
- Testes backend: candidatos, validações de status/recorrência/membro/empresa/CNPJ, empresa nova pendente/existente preservada, idempotência, concorrência e recuperação pós-Stripe.
- Testes de perfil: admin edita campos permitidos com auditoria, CNPJ/assinatura/status/tier/selo permanecem, responsável atual não perde acesso e URLs inválidas falham.
- Testes de webhook: próxima invoice usa empresa após metadados; histórico e wallet pessoal não mudam.
- Testes React: busca, candidatos, empresa nova/existente, confirmação, erro e repetição.
- Gates completos de backend/frontend/tenants e revisão independente.
- Rollout: migration → backend → frontend → uma conversão controlada e expressamente autorizada, seguida de conferência da mesma assinatura e da próxima invoice.

A implementação usa bump minor e atualiza changelog, roadmap e ADRs 003/010 somente após verificação.
