<!-- AGENT-INDEX
purpose: Restaurar comprovantes PDF de doações PF/PJ na Transparência e na área da empresa.
audience: Implementers, revisores e operadores de rollout.
status: Desenho derivado da solicitação explícita de reativação; pronto para plano.
sections:
  - Contexto e evidências
  - Objetivos e recorte
  - Abordagens
  - Desenho escolhido
  - Verificação e rollout
related-docs:
  - ../../adrs/003-club-business-pj.md — assinatura e comprovante empresarial
  - ../../adrs/010-business-tiers.md — fluxo público e privado de empresas
agent-protocol:
  - Não expor comprovantes empresariais sem a autorização já existente.
  - Não criar um segundo layout de PDF nem alterar Stripe/ledger.
-->

# Comprovantes de doação PF e PJ

## Contexto e evidências

O gerador antigo `DonationReceiptPdf` produzia PDF no navegador com `jspdf` e `html2canvas`, inclusive dados da empresa e QR para `/transparencia?tx=<id>`. Na migração para Astro, `TransactionDetailDialog` manteve uma nota explícita de que o botão e o gerador não foram portados.

O backend empresarial preserva `GET /companies/:id/receipt?month=YYYY-MM`, com autorização, consulta da fatura paga e dados de declaração. Entretanto, `/membros/empresa` apresenta esse JSON como se fosse download e não permite escolher o mês.

## Objetivos e recorte

- Restaurar **Baixar comprovante PDF** em doações PF e PJ na Transparência.
- PJ exibe nome e CNPJ da projeção pública; PF usa nome público quando disponível e handle como fallback.
- Incluir valor, data, destinatário, tipo, referência Stripe e QR de verificação.
- Em `/membros/empresa`, permitir escolher o mês e baixar PDF usando a fatura autenticada.
- Mostrar progresso e erro acessível; falha não deixa elementos temporários no DOM.
- Carregar bibliotecas pesadas somente ao solicitar o PDF.
- Não alterar Stripe, ledger, autorização, formato dos endpoints ou regras de ativação.

## Abordagens

1. **Restaurar o gerador no navegador (escolhida).** Reutiliza o comportamento e as versões já usadas pelo projeto (`jspdf` 4 e `html2canvas` 1), mantém a verificação pública e exige mudanças apenas no frontend. O custo é o download dessas bibliotecas no momento da ação.
2. Gerar PDF no backend. Evitaria dependências no cliente, mas criaria um segundo contrato de PDF, exigiria biblioteca/backend novo e mudanças de rollout sem necessidade.
3. Exibir apenas JSON/HTML para impressão. Seria menor, mas não restaura o comprovante PDF solicitado nem a experiência anterior.

## Desenho escolhido

Criar `frontend/src/components/islands/DonationReceiptPdf/index.tsx` com um modelo interno único de apresentação e duas entradas:

- `generateReceiptPdf`: recebe a transação pública do ledger e gera o comprovante PF/PJ da Transparência.
- `generateCompanyReceiptPdf`: recebe a resposta autenticada de `/companies/:id/receipt` e gera o comprovante empresarial, incluindo a declaração e a fatura.

As duas entradas compartilham layout, limpeza do DOM, QR e download. O QR da Transparência aponta para a transação exata; o empresarial aponta para `/transparencia` e informa a fatura Stripe.

`TransactionDetailDialog` volta a exibir o botão somente para `donation` e `donation-business`, usando `import.meta.env.SITE` como origem. O carregamento de jsPDF/html2canvas ocorre dentro do gerador.

Um componente de download empresarial na área da empresa terá `input type="month"` com rótulo visível, botão, estado de geração e `Alert` de erro. A chamada usa `authFetch` e o mês selecionado; o botão de JSON é substituído por esse fluxo.

## Verificação e rollout

- RED antes da implementação: botão PF/PJ na Transparência inexistente e fluxo empresarial sem PDF/mês.
- Testes do gerador: dados PF/PJ, referência, QR e limpeza após sucesso/erro.
- Testes do diálogo: PDF PF e PJ com CNPJ; nenhum botão para tipos não doação.
- Testes da empresa: mês na query, autenticação, sucesso, erro e ausência de download inválido.
- Gates: frontend test/check, `make astro-verify`, `make astro-verify-tenants`; backend somente build/testes se houver mudança.
- Sem migration ou bump de backend. Rollout somente frontend após CI/Sonar e autorização de merge.
