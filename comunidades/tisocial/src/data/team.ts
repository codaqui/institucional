export interface Member {
  name: string;
  role: string;
  specialty?: string;
  avatar: string;
  linkedin?: string;
  github?: string;
}

const AVATAR_BASE = "/img/comunidades/tisocial/equipe";

export const equipeImpacto: Member[] = [
  {
    name: "Amanda Veras",
    role: "Voluntária",
    specialty: "Gerente de Marketing",
    avatar: `${AVATAR_BASE}/amanda.jpg`,
    linkedin: "https://www.linkedin.com/in/amannda-veras/"
  },
  {
    name: "Ana Letícia Mania Feijó",
    role: "Voluntária",
    specialty: "Governança de TI",
    avatar: `${AVATAR_BASE}/ana-leticia.jpg`,
    linkedin: "https://www.linkedin.com/in/analeticiamania/"
  },
  {
    name: "Caroline Fiori",
    role: "Voluntária",
    specialty: "Especialista em Employer Branding",
    avatar: `${AVATAR_BASE}/caroline.jpg`,
    linkedin: "https://www.linkedin.com/in/caroline-fiori-454730b1/"
  },
  {
    name: "Emerson Rafael Marchi",
    role: "Voluntário",
    specialty: "Encarregado de Recursos Humanos",
    avatar: `${AVATAR_BASE}/emerson.jpg`,
    linkedin: "https://www.linkedin.com/in/ermarchi/"
  },
  {
    name: "Jean da Silva Baldaia",
    role: "Voluntário",
    specialty: "Analista de Inovação",
    avatar: `${AVATAR_BASE}/jean.jpg`,
    linkedin: "https://www.linkedin.com/in/jeanbaldaia/"
  },
  {
    name: "Júlia Nicolodi",
    role: "Voluntária",
    specialty: "Comunicação interna",
    avatar: `${AVATAR_BASE}/julia.jpg`,
    linkedin: "https://www.linkedin.com/in/j%C3%BAlia-nicolodi-10a308181/"
  },
  {
    name: "Renan Ceratto",
    role: "Voluntário",
    specialty: "O programador",
    avatar: `${AVATAR_BASE}/renan.jpg`,
    linkedin: "https://www.linkedin.com/in/renanceratto/"
  },
  {
    name: "Você?",
    role: "Voluntário",
    specialty: "Impacto Social",
    avatar: "https://github.com/ghost.png",
    linkedin: "https://www.instagram.com/tisocialmaringa",
  },
];
