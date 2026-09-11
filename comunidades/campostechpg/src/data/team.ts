export interface Mentor {
  name: string;
  role: string;
  specialty?: string;
  avatar: string;
  linkedin?: string;
  instagram?: string;
}

const AVATAR_BASE = "/img/comunidades/campostechpg/mentores";

export const mentores: Mentor[] = [
  {
    name: "Bruno Henrique",
    role: "Mentor",
    specialty: "Marketing Digital, Gestão de Tráfego",
    avatar: `${AVATAR_BASE}/bruno.jpg`,
    linkedin: "https://www.linkedin.com/in/brunohdeoliveira",
    instagram: "https://www.instagram.com/o_brunoh",
  },
  {
    name: "Bruno Gardinal",
    role: "Mentor",
    specialty: "Mercado financeiro para tecnologia",
    avatar: `${AVATAR_BASE}/brunog.jpg`,
    linkedin: "https://www.linkedin.com/in/bruno-gardinal/",
    instagram: "https://instagram.com/bgardinal",
  },
  {
    name: "Christopher Paes",
    role: "Mentor",
    specialty: "Marketing, Branding, Publicidade",
    avatar: `${AVATAR_BASE}/christopher.jpg`,
    linkedin: "https://www.linkedin.com/in/christopherpaes/",
    instagram: "https://www.instagram.com/euchrispaes/",
  },
  {
    name: "Daniel Lopes da Silva",
    role: "Mentor",
    specialty: "QA, Automação de Testes",
    avatar: `${AVATAR_BASE}/daniel.jpg`,
    linkedin: "https://www.linkedin.com/in/daniel-lopes-qa/",
  },
  {
    name: "Eduardo Saito",
    role: "Mentor",
    specialty: "Desenvolvimento mobile",
    avatar: `${AVATAR_BASE}/saito.jpg`,
    linkedin: "https://www.linkedin.com/in/saito-eduardo/",
    instagram: "https://www.instagram.com/edu_saito/",
  },
  {
    name: "Elina Torres",
    role: "Mentor",
    specialty: "Gestão e Design de produto",
    avatar: `${AVATAR_BASE}/elina.jpg`,
    linkedin: "https://www.linkedin.com/in/elina-torres/",
    instagram: "https://www.instagram.com/elinatorresn",
  },
  {
    name: "Everson Ribeiro",
    role: "Mentor",
    specialty: "Lean, melhoria contínua, A3, OKR",
    avatar: `${AVATAR_BASE}/everson.jpg`,
    linkedin: "https://www.linkedin.com/in/everson-ribeiro-3b798530",
    instagram: "https://www.instagram.com/_eversonribeiro/",
  },
  {
    name: "Fernando Barreto",
    role: "Mentor",
    specialty: "Banco de Dados, Segurança da Informação",
    avatar: `${AVATAR_BASE}/fernando.jpg`,
    linkedin: "https://www.linkedin.com/in/fernando-barreto",
    instagram: "https://www.instagram.com/ferbarreto2504",
  },
  {
    name: "Flávia Santos",
    role: "Mentor",
    specialty: "QA, Testes",
    avatar: `${AVATAR_BASE}/flavia.jpg`,
    linkedin: "https://www.linkedin.com/in/fl%C3%A1via-santos-a361a6174",
  },
  {
    name: "Goku (João Vitor dos Santos)",
    role: "Mentor",
    specialty: "QA, Testes, Transição de carreira em tecnologia",
    avatar: `${AVATAR_BASE}/goku.jpg`,
    linkedin: "https://www.linkedin.com/in/qakarotto/",
    instagram: "https://www.instagram.com/qakarotto/",
  },
  {
    name: "Jônatas S. da Costa",
    role: "Mentor",
    specialty: "Design de produto, transporte e logística",
    avatar: `${AVATAR_BASE}/jonatas.jpg`,
    linkedin: "https://www.linkedin.com/in/jonatas-silva-costa/",
    instagram: "https://www.instagram.com/jonatas.silva.costa/",
  },
  {
    name: "Leandro Santana",
    role: "Mentor",
    specialty: "Design de Produto",
    avatar: `${AVATAR_BASE}/leandro.jpg`,
    linkedin: "https://www.linkedin.com/in/leandrogsantana/",
    instagram: "https://www.instagram.com/leandrosantan.a/",
  },
];
