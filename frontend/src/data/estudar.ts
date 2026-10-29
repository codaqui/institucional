// Portado de src/pages/participe/estudar.tsx (site Docusaurus) — dados da
// página #QueroEstudar. No Astro, a página fica em src/pages/participe/estudar.astro.

import { DISCORD_URL } from "./social";

export const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdt1Klx324MMMCswN7ot-FnvTLvWEEQW711ySbHomHCd0OGLw/viewform";

export interface Turma {
  mes: string;
  modalidade: string;
  datas: string;
  instrutor: string;
  plataforma: string;
  blogHref?: string;
}

export const TURMAS: Turma[] = [
  {
    mes: "Fevereiro",
    modalidade: "Gestão e Produtividade",
    datas: "18/02 (Intro), 24/02 e 02/03",
    instrutor: "Danilo Mesquita",
    plataforma: "Discord",
    blogHref: "/blog/2026/01/29/curso-de-gestao-e-produtividade-com-danilo-mesquita",
  },
  {
    mes: "Abril e Maio",
    modalidade: "Educação Financeira",
    datas: "13/04, 27/04, 04/05, 11/05 e 18/05 às 19h30",
    instrutor: "Valnaire Nascimento",
    plataforma: "Discord",
    blogHref: "/blog/2026/03/30/curso-educacao-financeira",
  },
  {
    mes: "Abril e Maio",
    modalidade: "Lógica de Programação com Python",
    datas: "27/04, 29/04, 05/05 e 12/05 às 20h30",
    instrutor: "Paulinea",
    plataforma: "Discord",
    blogHref: "/blog/2026/03/30/curso-introducao-python",
  },
  { mes: "Maio", modalidade: "Product Discovery & Plataforma como Produto", datas: "A confirmar", instrutor: "A confirmar", plataforma: "Discord" },
  { mes: "Junho", modalidade: "FinOps / CloudSRE", datas: "A confirmar", instrutor: "A confirmar", plataforma: "Discord" },
  { mes: "Julho", modalidade: "C# e SQL", datas: "A confirmar", instrutor: "A confirmar", plataforma: "Discord" },
  { mes: "Agosto", modalidade: "First Steps and Understanding Rust", datas: "A confirmar", instrutor: "A confirmar", plataforma: "Discord" },
  { mes: "Setembro", modalidade: "NodeJS", datas: "A confirmar", instrutor: "A confirmar", plataforma: "Discord" },
  { mes: "Setembro", modalidade: "Cibersegurança", datas: "A confirmar", instrutor: "A confirmar", plataforma: "Discord" },
  { mes: "Outubro", modalidade: "A confirmar", datas: "A confirmar", instrutor: "A confirmar", plataforma: "Discord" },
  { mes: "Novembro", modalidade: "Kotlin e KMP", datas: "A confirmar", instrutor: "A confirmar", plataforma: "Discord" },
];

export const GRUPOS_ESTUDO = [
  { tema: "Arquitetura de Software e DDD", mediador: "Eugênio Tavares" },
];

export const TRACKS = [
  { emoji: "🐍", name: "Python", href: "/trilhas/python" },
  { emoji: "🐙", name: "GitHub", href: "/trilhas/github" },
];

export interface Step {
  number: string;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
  external: boolean;
}

export const HOW_IT_WORKS: Step[] = [
  {
    number: "01",
    title: "Encontros semanais",
    description:
      "Encontros virtuais via Discord com um mentor, abordando conteúdos do mundo da tecnologia conforme o nível do grupo.",
    href: DISCORD_URL,
    linkLabel: "Entrar no Discord →",
    external: true,
  },
  {
    number: "02",
    title: "Trilhas de aprendizado",
    description:
      "Estude de forma autônoma com nossas trilhas de Python e GitHub — disponíveis a qualquer hora.",
    href: "/trilhas",
    linkLabel: "Ver trilhas →",
    external: false,
  },
  {
    number: "03",
    title: "Mentoria individual",
    description:
      "Precisa de acompanhamento mais próximo? Solicite uma mentoria individual com um de nossos voluntários.",
    href: "/participe/mentoria",
    linkLabel: "Saiba mais sobre mentoria →",
    external: false,
  },
];

export interface CertificateStep {
  number: string;
  text: string;
  href: string | null;
  linkLabel: string | null;
}

export const CERTIFICATE_STEPS: CertificateStep[] = [
  {
    number: "01",
    text: "Aceitar o convite para iniciar o certificado",
    href: "https://classroom.github.com/a/jFE-cOK3",
    linkLabel: "Aceitar convite →",
  },
  {
    number: "02",
    text: "O convite cria automaticamente um repositório para você em github.com/codaqui/python-101-SEUUSUARIO",
    href: null,
    linkLabel: null,
  },
  {
    number: "03",
    text: "Responda todos os exercícios e crie os arquivos necessários no repositório.",
    href: null,
    linkLabel: null,
  },
  {
    number: "04",
    text: "Abra uma issue solicitando o certificado — descreva como foi realizar os exercícios.",
    href: "https://github.com/codaqui/institucional/issues/new/choose",
    linkLabel: "Abrir issue →",
  },
];
