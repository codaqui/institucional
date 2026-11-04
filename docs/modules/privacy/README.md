<!-- AGENT-INDEX
purpose: Documentação viva de privacidade e proteção de dados da Codaqui — página pública, inventário de tratamentos e retenções.
audience: Mantenedores, diretoria, DPO/canal de privacidade e AI agents alterando coletas de dados.
status: implementado na Fase 1b; revisão jurídica obrigatória antes do merge em main.
sections:
  - Fontes públicas
  - Quando atualizar
  - Gates de revisão
related-docs:
  - docs/modules/privacy/treatments.md — inventário dado → finalidade → compartilhamento → retenção
  - frontend/src/pages/sobre/privacidade.astro — Política pública
  - frontend/src/pages/sobre/conduta.astro — Código de Conduta e referência LGPD
  - docs/plans/codaqui-1-0/fase-1b.md — P1/P2/P3
agent-protocol:
  - Toda nova coleta, operador ou retenção exige atualizar treatments.md e a página pública no mesmo PR.
  - Não declarar ausência absoluta de PII nem de dados de adolescentes; revisar texto legal com pessoa responsável antes do merge.
-->

# Privacidade e Proteção de Dados

## Fontes públicas

- Política: `frontend/src/pages/sobre/privacidade.astro`
- Inventário: `docs/modules/privacy/treatments.md`
- Autosserviço: `frontend/src/components/islands/member/privacy/MyDataTab.tsx`
- API de visibilidade: `GET/PATCH /members/me/visibility`

## Quando atualizar

Atualize os documentos ao adicionar ou alterar:

- campos pessoais, finalidades ou bases legais;
- operadores e compartilhamentos com terceiros;
- retenção, exclusão, anonimização ou perfis de titulares;
- snapshots, perfis públicos, formulários guest e analytics.

## Gates de revisão

- Inventário corresponde ao código e às configurações reais.
- Página pública e autosserviço usam o mesmo vocabulário.
- Revisão jurídica e da diretoria registrada antes do merge em `main`.
