<!-- AGENT-INDEX
purpose: Inventário operacional dos tratamentos de dados pessoais da Codaqui — dados, finalidade, acesso, compartilhamento e retenção.
audience: DPO/canal de privacidade, diretoria, mantenedores e revisão jurídica.
status: baseline Fase 1b; requer revisão humana antes da publicação em produção.
sections:
  - Titulares e dados
  - Compartilhamento com operadores
  - Retenção e visibilidade
  - Direitos e canal
related-docs:
  - docs/modules/privacy/README.md — regras de atualização e gates
  - frontend/src/pages/sobre/privacidade.astro — versão pública
agent-protocol:
  - Atualizar esta tabela junto de qualquer mudança de coleta, snapshot ou retenção.
  - Usar dados sintéticos em exemplos; nunca incluir segredos ou PII real.
-->

# Inventário de tratamentos

## Titulares e dados

| Titular | Dados/fonte | Finalidade | Acesso/compartilhamento | Retenção |
|---|---|---|---|---|
| Visitante | Página, dispositivo, país e IP mascarado pelo Google Analytics | Medição e melhoria do site | Google Analytics | Conforme política da Google; não usado para publicidade |
| Membro | GitHub ID, handle, nome, avatar, e-mail e e-mails verificados | OAuth, conta e correspondência de inscrições | GitHub; banco Codaqui | Enquanto a conta estiver ativa ou houver obrigação legal |
| Membro | Bio, LinkedIn, roles, designations, entrada e histórico | Perfil público e representações | Visitantes, conforme `profileVisibility` | Preferência editável em Meus dados; histórico governança permanente |
| Membro | Doações, assinaturas, SortCoins, eventos e certificados | Apoio, clube, participação e prestação de contas | Stripe e banco Codaqui; exposição pública configurável em Meus dados | Registros financeiros conforme obrigação legal; históricos públicos configuráveis |
| Mentorando convidado (futuro) | Nome, e-mail, tema e sessão | Agendamento e comunicação de mentoria | SMTP/Google e banco Codaqui | Política específica da Fase 5; remoção sob solicitação |
| Empresa/PJ | CNPJ, responsável, assinatura e comprovantes | Gestão de apoio e transparência | Stripe, banco Codaqui e serviço externo de comprovantes | Obrigação legal e histórico empresarial |
| Palestrante C4P (futuro) | Nome, e-mail, telefone, LinkedIn, proposta e consentimento | Submissão, curadoria e resultado | Organizadores/avaliadores; resultado somente opt-in | Política específica da Fase 7; notas nunca públicas |
| Participante de evento | Nome, e-mail, ingresso, presença e certificado | Inscrição, check-in, emissão e verificação | Banco Codaqui; certificado por código, salvo ocultação pelo membro vinculado | Histórico do evento e verificação pública configurável |
| Convidado de evento | Nome, e-mail, consentimento e presença | Inscrição sem conta, confirmação, lembrete e check-in | Cloudflare Turnstile, banco Codaqui e SMTP | Nome/e-mail anonimizados 12 meses após o evento se não houver vínculo; token e presença preservados |

## Compartilhamento com operadores

- **GitHub:** OAuth, e-mails verificados, avatar, comentários Giscus e Discussions públicas.
- **Stripe:** checkout, cobrança, assinatura, reembolso e conciliação financeira.
- **Google:** Analytics, SMTP/Gmail e links externos de comprovantes quando escolhidos pela equipe.
- **Cloudflare:** hospedagem, proxy, Turnstile e metadados técnicos de requisição; tokens Turnstile não são persistidos pela Codaqui, somente hash temporário anti-reuso.
- **Dropbox, OneDrive, Imgur:** somente quando uma URL de comprovante é escolhida pela equipe; o backend não faz upload.

## Retenção e visibilidade

- Sessão JWT: até 7 dias; handoff OAuth: até 2 minutos.
- `email_logs`: até 365 dias; e-mails sem SMTP ficam `skipped`, não `failed`.
- Logs operacionais de auditoria: 30 dias por padrão, configurável 7–365 dias.
- Logs de governança e designations: permanentes, sem IP.
- Ledger financeiro: preservado conforme obrigação legal e necessidade de prestação de contas.
- `profileVisibility`: até edição pelo membro; alterações de visibilidade geram audit de governança. E-mail nunca é público.
- Aba Meus dados mostra fonte e finalidade e permite ocultar campos do perfil público após refresh/build aplicável.

## Direitos e canal

Titulares podem solicitar confirmação/acesso, correção, portabilidade, eliminação quando cabível, informação sobre compartilhamento e revogação de consentimento por **contato@codaqui.dev**, assunto **LGPD — Direitos do Titular**. Também podem reclamar à ANPD. Não vendemos, alugamos nem cedemos dados pessoais a terceiros.
