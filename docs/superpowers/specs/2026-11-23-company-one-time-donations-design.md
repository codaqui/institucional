<!-- AGENT-INDEX
purpose: Desenho da doação empresarial única para Tesouro ou comunidades Integradas, separada do CLUB Business e sem benefícios adicionais.
audience: Presidência, mantenedores, implementadores e revisores.
status: Concluído em 1.10.0 com TDD, jornada PostgreSQL e revisão independente; PR para develop em preparação.
sections:
  - Intenção e decisões confirmadas
  - Objetivos e limites
  - Abordagens
  - Contrato e arquitetura
  - Experiência PJ
  - Ledger, recibos e transparência
  - Estados, segurança e acessibilidade
  - Verificação, rollout e documentação
related-docs:
  - ../../adrs/003-club-business-pj.md — regras da assinatura empresarial preservadas.
  - ../../adrs/007-community-registry.md — comunidades Integradas elegíveis.
  - ../../../PRODUCT.md — público e princípios do produto.
agent-protocol:
  - Não alterar assinatura, ativação, vitrine, selo, badges ou SortCoins existentes.
  - Não criar cobrança real, migration ou ativação automática de empresa.
-->

# Doações empresariais únicas

## Intenção e decisões confirmadas

Permitir que uma empresa faça uma doação pontual para a Codaqui ou para uma comunidade Integrada ativa. Essa contribuição ajuda a causa, mas **não é patrocínio**, não coloca a empresa em `/patrocinadores` e não concede benefícios.

Decisões confirmadas pela presidência:

- Exigir login do responsável e CNPJ, preservando recibo PJ e vínculo empresarial.
- Permitir Tesouro Codaqui e comunidades Integradas ativas.
- Criar checkout avulso dedicado dentro da jornada PJ, sem alterar o contrato da assinatura.
- Empresa nova continua `pending`; nenhuma doação única ativa empresa, vitrine, selo, badge ou SortCoins.
- Somente empresas `pending` e `active` podem doar; `past_due`, `suspended` e `cancelled` recebem bloqueio explícito.

## Objetivos e limites

### Objetivos

- Oferecer pagamento único Stripe para empresa, com valor de doação avulsa, sem o mínimo de R$ 200/mês da assinatura.
- Reutilizar cadastro do responsável, seleção de comunidade, validação de valor, checkout embutido/hosted e comprovante existentes.
- Atribuir corretamente `companyId`, destino e natureza única no ledger e na transparência.
- Diferenciar “Doação empresarial única” de “Assinatura mensal empresarial” em todo o caminho de leitura.
- Preservar deep links existentes para a assinatura e oferecer deep link para a doação única.

### Não objetivos

- Não mudar planos, ativação manual, conversão PF→PJ, status, wallet, SortCoins, badges ou regras de patrocínio.
- Não emitir nota fiscal nem prometer benefícios, recorrência ou destino diferente do selecionado.
- Não permitir doação anônima de empresa nem checkout por terceiro que não seja o responsável.
- Não criar migration, novo modelo de empresa ou segunda fonte de comunidades.
- Não realizar pagamento real, ativação real ou mutação externa durante os testes.

### Anti-objetivo

Uma implementação que registre pagamento único como assinatura, altere `subscriptionAmountCents`, ative uma empresa ou faça uma comunidade inativa receber doações será considerada incorreta mesmo que o checkout funcione.

## Abordagens

1. **Checkout avulso dedicado — escolhido.** Novo endpoint e fluxo avulso dentro de PJ, reutilizando identidade e comunidades. Mantém o contrato da assinatura isolado.
2. **Modo avulso no endpoint da assinatura.** Menos endpoints, mas mistura `subscriptionAmountCents`, metadata e efeitos de dois produtos.
3. **Empresa no checkout genérico PF.** Reuso aparente, mas autorização e regras PF/PJ ficam acopladas e mais fáceis de contornar.

## Contrato e arquitetura

### Endpoint

`POST /stripe/checkout-session/company/one-time`, protegido por `JwtAuthGuard`.

Body:

```ts
{
  companyId: string;
  amount: number; // centavos inteiros, mesmas faixas da doação avulsa
  communityId: string; // "tesouro-geral" ou comunidade Integrada ativa
  uiMode?: "embedded_page" | "hosted";
  returnPath?: string;
}
```

Regras:

- Resolver a empresa, exigir `responsibleMemberId === req.user.sub` e status `pending` ou `active`; demais status recebem orientação de regularização.
- Validar valor no servidor com as faixas da doação avulsa, não com o mínimo da assinatura.
- Validar `communityId` com a mesma regra do checkout PF; Tesouro é aceito explicitamente.
- Criar Stripe Checkout com `mode: "payment"`; não usar `recurring`, `subscription_data` ou `setSubscriptionAmount`.
- Usar `payment_method_configuration` como no checkout avulso PF, incluindo o caminho de confirmação assíncrona quando o método exigir.
- Reutilizar customer da empresa quando existir e e-mail do responsável quando aplicável. Não persistir um novo `stripeCustomerId` por doação única nem exigir `customer_creation`; o recibo não depende desse vínculo.
- Metadata: `entityType: "business"`, `companyId`, `memberId`, `communityId`, `amountCents`, `isSubscription: "false"`.
- Preservar sanitização de `returnPath`; retorno padrão `/participe/apoiar?modo=empresa&apoio=unica`.
- Retornar `clientSecret` no modo embutido e `{sessionId,url}` no hosted.

O endpoint `/stripe/checkout-session/company` da assinatura permanece com seu contrato atual.

## Experiência PJ

Alvo: `/participe/apoiar?modo=empresa`, mantendo o sistema visual incumbente.

- O painel PJ oferece a escolha **Doação única** ou **Assinatura mensal**, apresentando um fluxo por vez, sem criar outro nível de tabs.
- `/participe/apoiar?modo=empresa` continua abrindo a assinatura para não alterar CTAs atuais. `?modo=empresa&apoio=unica` abre o pagamento único.
- A doação única apresenta: explicação “sem patrocínio e sem benefícios”, destino Tesouro/comunidades, valor, dados da empresa e CTA com o valor exato.
- O cadastro/login e os dados compartilhados da empresa são extraídos para um hook/componente de identidade usado pelos dois fluxos; não duplicar `POST /companies` nem permitir cadastros concorrentes divergentes.
- O seletor de comunidades reutiliza a mesma fonte do fluxo PF e mostra somente opções elegíveis no cliente; o servidor continua sendo a autoridade.
- A assinatura preserva tiers, copy de benefícios e gerenciamento existentes. Somente a área avulsa contém a afirmação de ausência de benefícios.
- Sucesso do Stripe confirma a doação e orienta recibo/transparência; cancelamento devolve à escolha sem apagar os dados preenchidos.

## Ledger, recibos e transparência

- `resolveCheckoutDonationMetadata` passa a projetar também `companyId` e `companyName` para pagamentos empresariais únicos.
- `recordDonationToLedger` usa:
  - empresa + `isSubscription=false` → **Doação empresarial única**;
  - empresa + `isSubscription=true` → **Assinatura mensal empresarial**.
- A descrição mantém `Empresa: <nome> [companyId]`, permitindo detecção `donation-business`, extração pública e geração do recibo existentes. Na doação única inclui também `[memberId]` do responsável, seguindo a exposição já usada nas doações PF, para que a transação apareça em **Minhas doações**.
- O ledger continua em dupla partida, com `referenceId` idempotente e destino validado.
- O detalhe da transação deixa de rotular toda doação empresarial como recorrente: pagamento único mostra “Pagamento único”; assinatura mostra o texto atual.
- O recibo PDF usa o rótulo do tipo registrado e continua contendo empresa, CNPJ, destino, valor e referência Stripe. O responsável acessa a transação em **Minhas doações** e abre o recibo pelo `TransactionDetailDialog`; a transparência pública usa o mesmo documento. Não estender o endpoint mensal de recibos baseado em invoices.
- `/patrocinadores` não muda: continua listando somente empresas `active`. Uma empresa nova permanece `pending`, e uma empresa já ativa não tem status ou benefícios alterados pela doação avulsa.

## Estados, segurança e acessibilidade

- Login ausente, empresa inexistente, responsável incorreto, status fora de `pending`/`active`, comunidade inválida/inativa, valor inválido, erro do Stripe, retorno cancelado, pagamento assíncrono pendente e webhook repetido têm comportamento explícito.
- Formulários usam `<form>`, labels persistentes, `name`, campos obrigatórios, helper text e botão submit com ação/valor claros.
- Erros de valor e CNPJ aparecem após interação ou submit, com foco no primeiro erro; `aria-invalid`, `aria-describedby` e anúncio acessível acompanham o estado visual.
- Botões só são desabilitados após submissão válida para evitar duplo POST; resultados AJAX usam região de status apropriada.
- CNPJ e dados empresariais não entram em logs de analytics nem em URLs. PII pública continua limitada às projeções atuais.

## Verificação, rollout e documentação

- TDD no controller/service: responsável, status permitido/bloqueado, valor, comunidade, `mode: payment`, PMC, metadata, customer sem nova persistência, retorno e ausência de efeitos na assinatura/status.
- Webhook: ledger único vs recorrente, destino, empresa, responsável em Minhas doações, confirmação assíncrona, idempotência e fee existente.
- Frontend: escolha do modo PJ, deep links, cadastro compartilhado, destino, valor, submissão, cancelamento/sucesso e acessibilidade dos erros.
- Transação/recibo: `donation-business`, “Pagamento único” vs assinatura e PDF empresarial.
- Jornada isolada com PostgreSQL em dump e Stripe totalmente mockado: cadastro `pending` → checkout único para Tesouro e comunidade → webhook → ledger/recibo → empresa continua `pending` e fora de patrocinadores.
- `cd backend && npm run build && npx jest --silent`; `cd frontend && npm run check && npm run test`; `make astro-verify` e `make astro-verify-tenants`.
- Inspeção visual da escolha PJ e do formulário avulso em mobile/desktop e nos dois temas.
- Atualizar ADR 003, `PRODUCT.md`, inventário/índice de planos e `CHANGELOG.md`. Bump **minor para 1.10.0** em frontend/backend e lockfiles.
- Rollout: backend antes do frontend. Trabalhar na `develop`, validar, enviar e abrir PR de `develop` para `main`; nenhuma publicação ou cobrança real sem autorização posterior.
