export interface TimelineEvent {
  year: number;
  label: string;
  icon: string;
  color: "success" | "info" | "warning" | "error" | "primary" | "secondary" | "grey";
  description?: string;
  items: string[];
}

export const timelineEvents: TimelineEvent[] = [
  {
    year: 2020,
    label: "Primeiros Passos",
    icon: "🌱",
    color: "success",
    description:
      "Início da jornada que levou à criação do Codaqui.",
    items: [
      "Primeiro projeto Kids Academy iniciado — foco em crianças de 6 a 10 anos",
      "Participação do Dev Starter — aprendizado e troca com a comunidade DevParaná",
      "Primeiros mentores voluntários se juntaram à iniciativa",
    ],
  },
  {
    year: 2021,
    label: "Nascimento do Codaqui",
    icon: "🎉",
    color: "success",
    description:
      "O Kids Academy evoluiu e surgiu a Associação Codaqui, com foco em jovens de 12 a 17 anos.",
    items: [
      "Fundação da Associação Codaqui (CNPJ 44.593.429/0001-05)",
      "Primeiras turmas com jovens de 12 a 17 anos",
      "Parceria com DevParaná consolidada",
      "Primeiros projetos open source lançados",
    ],
  },
  {
    year: 2022,
    label: "Expansão Digital",
    icon: "📈",
    color: "info",
    description: "Crescimento da equipe, das parcerias e da presença digital.",
    items: [
      "Expansão da equipe de mentores",
      "Novas comunidades parceiras: Elas no Código e CamposTech",
      "Lançamento do site institucional (codaqui.dev)",
      "Discord como plataforma principal de comunidade",
      "Trilhas de aprendizado no GitHub",
    ],
  },
  {
    year: 2023,
    label: "Ação Social e Reconhecimento",
    icon: "🏆",
    color: "info",
    description: "Codaqui ganha visibilidade e expande seu impacto social.",
    items: [
      "DevPR Conf 2023 — Codaqui presente como comunidade apoiadora",
      "Apoio ao Campeonato de Skate em Marialva",
      "Iniciativa DevPR Starter com foco em novos talentos",
      "31 mentorias realizadas totalizando 23 horas de mentoria",
      "17 participantes mentorados",
      "501 membros no Discord",
      "350 membros no WhatsApp",
    ],
  },
  {
    year: 2024,
    label: "Expansão Presencial",
    icon: "🏫",
    color: "warning",
    description:
      "Implementamos aulas presenciais no CPM em paralelo aos encontros virtuais.",
    items: [
      "1º Semestre: 25 encontros presenciais no CPM (Centro de Projetos de Maringá)",
      "2º Semestre: 16 encontros",
      "95 mentorias realizadas totalizando 66 horas de mentoria",
      "45 participantes mentorados",
      "Coleta de apoio via Open Collective",
      "DevPR Conf 2024 — prestação de contas publicada",
      "+14.000 visualizações mensais no site",
    ],
  },
  {
    year: 2025,
    label: "Crescimento Contínuo",
    icon: "🚀",
    color: "primary",
    description: "Retorno ao formato virtual com crescimento expressivo.",
    items: [
      "1º Semestre: 15 participantes (Aulas Virtuais)",
      "2º Semestre: 10 participantes (Aulas Virtuais)",
      "692 membros no Discord",
      "463 membros no WhatsApp",
      "+7.000 visualizações mensais no site",
      "DevPR Conf 2025 — prestação de contas publicada",
      "Cloud Native Maringá ingressa como comunidade parceira",
    ],
  },
  {
    year: 2026,
    label: "Resultados Parciais",
    icon: "📅",
    color: "secondary",
    description: "Nossos números em 2026 mostram o crescimento contínuo da nossa missão.",
    items: [
      "692 membros no Discord",
      "463 membros no WhatsApp",
      "Cursos de Educação Financeira e Introdução ao Python iniciados",
    ],
  },
];
