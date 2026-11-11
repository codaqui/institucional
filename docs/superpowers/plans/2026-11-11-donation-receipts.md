# Comprovantes de doação PF/PJ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restaurar PDFs de doações na Transparência e na área autenticada da empresa, com dados Stripe e verificação pública.

**Architecture:** Um gerador compartilhado renderiza um único layout e recebe tanto transações públicas do ledger quanto a resposta autenticada da fatura empresarial. jsPDF e html2canvas ficam sob dynamic import; os dois pontos de entrada apenas adaptam dados e estados de UI.

**Tech Stack:** Astro 7, React 19, MUI 9, TypeScript, Vitest, jsPDF 4, html2canvas 1, qrcode.react.

**Spec:** `docs/superpowers/specs/2026-11-11-donation-receipts-design.md`

## Global Constraints

- Não alterar backend, Stripe, ledger, autorização ou contratos JSON.
- PF/PJ da Transparência usam `/transparencia?tx=<transactionId>`; a fatura empresarial usa `/transparencia` e informa `stripeInvoiceId`.
- Bibliotecas de PDF somente sob dynamic import e somente após ação do usuário.
- Todo download tem progresso, erro acessível e limpeza do DOM em sucesso/falha.
- Sem migration ou bump de backend; frontend segue tokens/tema e padrões atuais.

## Review Focus

- Falha de html2canvas/jsPDF: o container temporário e o root React devem ser removidos; o botão volta ao estado normal e mostra erro.
- Empresa sem fatura no mês: exibir o erro da API e não gerar arquivo.
- Dados longos/Unicode: nome empresarial e CNPJ permanecem no conteúdo; referência não quebra layout.
- Clique repetido: enquanto gera, apenas uma execução fica ativa.
- Tenant: origem do QR vem de `import.meta.env.SITE`, sem hardcode de domínio.

---

### Task 1: Gerador compartilhado de PDF

**Files:**
- Create: `frontend/src/components/islands/DonationReceiptPdf/index.tsx`
- Create: `frontend/src/components/islands/DonationReceiptPdf/index.test.tsx`
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`

**Interfaces:**
- Consumes: `Transaction` e `deriveTransactionMeta` de `frontend/src/lib/transaction.ts`; resposta de `GET /companies/:id/receipt`.
- Produces: `generateReceiptPdf({tx,accountId,siteUrl,apiUrl?,companyData?,donorHandle?}): Promise<void>` e `generateCompanyReceiptPdf(receipt,siteUrl): Promise<void>`.

- [ ] **Step 1: Escrever RED do gerador**

Mockar `jspdf` e `html2canvas` por dynamic import. Testar PF, PJ com CNPJ, QR com a origem recebida e `pdf.save` com `comprovante-doacao-<prefixo>.pdf`; testar fatura empresarial com declaração e `stripeInvoiceId`. Simular falha de canvas e afirmar remoção de `#__receipt_pdf_container__`.

- [ ] **Step 2: Confirmar RED e instalar dependências históricas**

Run: `cd frontend && npx vitest run src/components/islands/DonationReceiptPdf/index.test.tsx`
Expected: falha por módulo inexistente.

Executar `npm install jspdf@^4.2.1 html2canvas@^1.4.1`, versões confirmadas no package.json anterior ao corte do Docusaurus.

- [ ] **Step 3: Implementar o gerador único**

Adaptar ledger/fatura para um modelo interno com valor, data, doador, destinatário, tipo, referência, URL de verificação e declaração opcional. Renderizar fora do viewport, gerar QR, aguardar renderização e usar `try/finally` para unmount/remoção. Não usar APIs experimentais de canvas.

- [ ] **Step 4: Confirmar GREEN e commit**

Run: `cd frontend && npx vitest run src/components/islands/DonationReceiptPdf/index.test.tsx`
Expected: todos os testes verdes, incluindo cleanup.

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/components/islands/DonationReceiptPdf
 git commit -m "feat(comprovantes): restaura gerador de doações"
```

### Task 2: PDF na Transparência

**Files:**
- Modify: `frontend/src/components/islands/TransactionDetailDialog.tsx`
- Create: `frontend/src/components/islands/__tests__/transaction-detail-dialog.test.tsx`

**Interfaces:**
- Consumes: `generateReceiptPdf` da Task 1 e `companyPublicInfo` já carregado pelo diálogo.
- Produces: botão **Baixar comprovante PDF** somente para `donation`/`donation-business`.

- [ ] **Step 1: Escrever RED do diálogo**

Mockar o gerador. Para doação PF `@octocat`, clicar e afirmar `accountId`, `apiUrl`, origem de `import.meta.env.SITE` e handle. Para doação empresarial, responder `/companies/company-1/public` com nome/CNPJ e afirmar esses dados na chamada. Para `vendor-payment`, afirmar ausência do botão. Simular rejeição e afirmar `Alert` e reabilitação.

- [ ] **Step 2: Confirmar RED**

Run: `cd frontend && npx vitest run src/components/islands/__tests__/transaction-detail-dialog.test.tsx`
Expected: botão de PDF não encontrado.

- [ ] **Step 3: Restaurar ação no diálogo**

Adicionar estados `generatingPdf`/erro, `CircularProgress`, botão com `type="button"`, chamada à Task 1 e `Alert` acessível. Remover o comentário que registra o PDF como pendência.

- [ ] **Step 4: Confirmar GREEN e commit**

Run: `cd frontend && npx vitest run src/components/islands/__tests__/transaction-detail-dialog.test.tsx src/components/islands/DonationReceiptPdf/index.test.tsx`
Expected: todos os testes verdes.

```bash
git add frontend/src/components/islands/TransactionDetailDialog.tsx frontend/src/components/islands/__tests__/transaction-detail-dialog.test.tsx
 git commit -m "feat(transparencia): reativa comprovantes PF e PJ"
```

### Task 3: Download mensal na área da empresa

**Files:**
- Create: `frontend/src/components/islands/member/company/CompanyReceiptDownload.tsx`
- Create: `frontend/src/components/islands/member/__tests__/company-receipt.test.tsx`
- Modify: `frontend/src/components/islands/member/company/CompanyHeader.tsx`
- Modify: `frontend/src/components/islands/member/__tests__/my-company.test.tsx`

**Interfaces:**
- Consumes: `receiptUrl` já fornecido por `MyCompanyApp`, `useAuth().authFetch` e `generateCompanyReceiptPdf` da Task 1.
- Produces: `CompanyReceiptDownload({receiptUrl}): JSX.Element`, com mês `YYYY-MM` e PDF da fatura.

- [ ] **Step 1: Escrever RED do fluxo mensal**

Mockar `useAuth` e o gerador. Clicar no botão e afirmar chamada a `/companies/company-1/receipt?month=<mês-atual>`, depois escolher `2026-07` e afirmar o novo mês. Verificar PDF com a resposta, `Alert` em 404 e nenhum download. Testar clique repetido durante Promise pendente: somente uma chamada.

- [ ] **Step 2: Confirmar RED**

Run: `cd frontend && npx vitest run src/components/islands/member/__tests__/company-receipt.test.tsx`
Expected: componente inexistente.

- [ ] **Step 3: Implementar e integrar**

Criar formulário com `input type="month"` e rótulo **Mês do comprovante**, estado inicial do mês atual, botão desabilitado durante geração e `Alert`. Substituir o link JSON em `CompanyHeader` por `CompanyReceiptDownload`; ajustar o teste existente para o novo comportamento.

- [ ] **Step 4: Confirmar GREEN e gates completos**

Run: `cd frontend && npx vitest run src/components/islands/member/__tests__/company-receipt.test.tsx src/components/islands/member/__tests__/my-company.test.tsx && npm run check && npm run test`
Expected: testes e tipos verdes.

Executar `make astro-verify && make astro-verify-tenants` na raiz. Limpar snapshots gerados não relacionados antes do commit.

```bash
git add frontend/src/components/islands/member/company/CompanyHeader.tsx frontend/src/components/islands/member/company/CompanyReceiptDownload.tsx frontend/src/components/islands/member/__tests__/company-receipt.test.tsx frontend/src/components/islands/member/__tests__/my-company.test.tsx docs/superpowers/specs/2026-11-11-donation-receipts-design.md docs/superpowers/plans/2026-11-11-donation-receipts.md
 git commit -m "feat(empresas): baixa comprovante mensal em PDF"
```

### Task 4: Revisão e PR

- [ ] Gerar review package da branch e obter revisão independente. Corrigir Critical/Important com RED→GREEN; registrar minors.
- [ ] Confirmar zero issues no SonarCloud e todos os checks verdes.
- [ ] Abrir PR para `develop`, sem merge/release sem comando explícito. Sequenciar após #633 e coordenar com #632 sem alterar seus escopos.
