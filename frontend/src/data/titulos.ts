export interface TituloLink {
  label: string;
  url: string;
  /** Se true, abre em nova aba (links externos) */
  external?: boolean;
}

export interface TituloMetadado {
  label: string;
  value: string;
}

export interface Titulo {
  id: string;
  titulo: string;
  /** Órgão emissor do título/reconhecimento */
  orgao?: string;
  descricao: string;
  /** Chip de destaque exibido no topo do card */
  destaque?: string;
  /** Logo/imagem servida localmente de static/img/ */
  imagem?: string;
  imagemAlt?: string;
  /** Dados estruturados exibidos em lista (ex: dados da lei) */
  metadados?: TituloMetadado[];
  links: TituloLink[];
}

export const titulos: Titulo[] = [
  {
    id: "selo-mapa-osc",
    titulo: "Selo OSC — Mapa das Organizações da Sociedade Civil",
    orgao: "IPEA — Instituto de Pesquisa Econômica Aplicada",
    destaque: "Cadastro oficial",
    descricao:
      "A Associação Codaqui está cadastrada no Mapa das OSC, plataforma do IPEA que mapeia e dá transparência às organizações da sociedade civil brasileiras, reunindo dados institucionais e de atuação.",
    imagem: "/img/titulos/mapa-osc-ipea.png",
    imagemAlt: "Logo do Mapa das Organizações da Sociedade Civil (IPEA)",
    links: [
      {
        label: "Ver perfil no Mapa OSC",
        url: "https://mapaosc.ipea.gov.br/selo-osc/1368150",
        external: true,
      },
    ],
  },
  {
    id: "utilidade-publica-municipal",
    titulo: "Declaração de Utilidade Pública Municipal",
    destaque: "Lei nº 12.181/2026",
    descricao:
      "A Câmara Municipal de Maringá reconheceu oficialmente a Associação Codaqui como entidade de utilidade pública municipal, por meio de lei ordinária que destaca o impacto social de seus programas de educação em tecnologia.",
    imagem: "/img/titulos/prefeitura-maringa.png",
    imagemAlt: "Brasão da Prefeitura Municipal de Maringá",
    metadados: [
      { label: "Norma", value: "Lei Ordinária nº 12.181, de 21/05/2026" },
      { label: "Município", value: "Maringá, Paraná" },
      { label: "Proposição", value: "Projeto de Lei Ordinária nº 17.960/2026" },
      { label: "Publicação", value: "Diário Oficial nº 4.843, de 22/05/2026" },
      { label: "Ementa", value: "Declara de Utilidade Pública a Associação Codaqui" },
    ],
    links: [
      {
        label: "Texto da lei (SAPL)",
        url: "https://sapl.cmm.pr.gov.br/norma/15180",
        external: true,
      },
      {
        label: "PDF oficial",
        url: "https://sapl.cmm.pr.gov.br/media/sapl/public/normajuridica/2026/15180/2612181lo.pdf",
        external: true,
      },
    ],
  },
  {
    id: "marca-registrada-inpi",
    titulo: "Marca Registrada no INPI",
    orgao: "INPI — Instituto Nacional da Propriedade Industrial",
    destaque: "Registro federal",
    descricao:
      "O INPI concedeu o registro da marca Codaqui, garantindo à Associação a propriedade e o uso exclusivo da marca por 10 anos, na classe de serviços de educação (NCL 41), em todo o território nacional.",
    metadados: [
      { label: "Processo", value: "935098860" },
      { label: "Titular", value: "Associação Codaqui — CNPJ 44.593.429/0001-05" },
      { label: "Depósito", value: "23/06/2024" },
      { label: "Concessão", value: "03/03/2026" },
      { label: "Vigência", value: "Até 03/03/2036" },
      { label: "Classe", value: "NCL 41 — Serviços de educação" },
    ],
    links: [
      {
        label: "Ver certidão (PDF)",
        url: "/assets/docs/certidao-marca-inpi.pdf",
      },
    ],
  },
];
