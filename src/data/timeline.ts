export interface TimelineStats {
  label: string;
  value: string;
  icon?: string;
}

export interface TimelineEvent {
  year: number;
  label: string;
  icon: string;
  color: "success" | "info" | "warning" | "error" | "primary" | "secondary" | "grey";
  description?: string;
  items: string[];
  stats?: TimelineStats[];
  highlights?: string[];
  tag?: string;
}

export const timelineEvents: TimelineEvent[] = [
  {
    year: 2020,
    label: "Primeiros Passos",
    icon: "🌱",
    color: "success",
    tag: "Origem",
    description:
      "Conversas e experiências que plantaram a semente do Codaqui.",
    items: [
      "Bate-papo com fundador da Tecnogueto sobre educação periférica",
      "Conversa com Zaedy Sayão sobre educação e tecnologia",
      "Primeiro emprego remoto do fundador — visão de oportunidades digitais",
      "Hackathon 2020 Campo Mourão: presidente como mentor, conheceu a primeira turma 'Kids Academy'",
    ],
    highlights: [
      "Hackathon Campo Mourão inspira a criação do projeto educacional",
    ],
  },
  {
    year: 2021,
    label: "Nascimento do Codaqui",
    icon: "🎉",
    color: "success",
    tag: "Fundação",
    description:
      "De 'Kids Academy' à Associação Codaqui — constituição jurídica, primeiros voluntários e primeiras turmas.",
    items: [
      "19/02/2021: Primeiro encontro 'Kids Academy' no Discord do devpr.org",
      "Jean, Diana Carvalho e Ivan Coelho Dias — primeiros voluntários",
      "Mudança de nome 'Kids Academy' → 'Codaqui'",
      "12 alunos contemplados no primeiro ciclo",
      "8 bolsas concedidas (R$ 50/mês por 6 meses)",
      "3 computadores doados para alunos",
      "1 trilha completa de Python finalizada",
      "Embasamento pedagógico por Lucia Maria Sendim Vieira",
      "Constituição jurídica — CNPJ: 44.593.429/0001-05",
    ],
    stats: [
      { label: "Alunos", value: "12", icon: "👩‍💻" },
      { label: "Bolsas", value: "8", icon: "🎓" },
      { label: "PCs doados", value: "3", icon: "💻" },
      { label: "Trilha", value: "1", icon: "📚" },
    ],
    highlights: [
      "Constituição jurídica da Associação Codaqui",
      "Primeira trilha de Python concluída com 12 alunos",
    ],
  },
  {
    year: 2022,
    label: "Consolidação e Crescimento Digital",
    icon: "📈",
    color: "info",
    tag: "Crescimento",
    description:
      "74 encontros realizados entre 2021-2022, novos parceiros e plataformas educacionais.",
    items: [
      "74 encontros realizados no período 2021-2022",
      "~15 alunos recorrentes, ~30 alunos no total do período",
      "Novos voluntários nas áreas Jurídica e Contábil",
      "Google Education (Google Ad Grants) concedido",
      "GitHub Education (GitHub Campus) concedido",
      "WorkAdventure — espaço virtual para encontros",
      "Expansão das trilhas de ensino",
      "Novas comunidades parceiras: Elas no Código e CamposTech",
    ],
    stats: [
      { label: "Encontros", value: "74", icon: "📅" },
      { label: "Alunos", value: "~30", icon: "👩‍💻" },
      { label: "Discord", value: "32", icon: "💬" },
      { label: "WhatsApp", value: "22", icon: "📱" },
    ],
    highlights: [
      "Google Ad Grants e GitHub Campus conquistados",
      "74 encontros com ~15 alunos recorrentes",
    ],
  },
  {
    year: 2023,
    label: "Remodelação e Impacto Social",
    icon: "🏆",
    color: "info",
    tag: "Marco",
    description:
      "Doações de computadores, lançamento do projeto Mentoria, financiamento coletivo e presença na DevPR Conf.",
    items: [
      "Doação de computadores para escola no Rio de Janeiro",
      "Lançamento do Projeto Mentoria (#QueroMentoria)",
      "Financiamento coletivo iniciado via Apoia.se, depois Open Collective",
      "Site institucional completamente remodelado",
      "Contratação de apoio organizacional",
      "Transparência mensal publicada via Apoia.se",
      "Doação de computadores pela Cortex Intelligence",
      "DevPR Conf 2023 — Codaqui presente como comunidade apoiadora",
      "Apoio ao Campeonato de Skate em Marialva",
      "DevPR Starter com Codaqui — foco em novos talentos",
    ],
    stats: [
      { label: "Discord", value: "501", icon: "💬" },
      { label: "WhatsApp", value: "350", icon: "📱" },
    ],
    highlights: [
      "Projeto Mentoria lançado — democratizando acesso a orientação profissional",
      "Doação de computadores para escola no RJ e pela Cortex Intelligence",
    ],
  },
  {
    year: 2024,
    label: "Expansão Presencial",
    icon: "🏫",
    color: "warning",
    tag: "Expansão",
    description:
      "Aulas presenciais no CPM, 95 mentorias realizadas e forte crescimento da comunidade.",
    items: [
      "1º Semestre: 25 encontros presenciais no CPM (Centro de Projetos de Maringá)",
      "2º Semestre: 16 encontros presenciais",
      "31 mentorias realizadas totalizando 23 horas",
      "17 alunos mentorados individualmente",
      "Coleta de apoio via Open Collective iniciada",
      "DevPR Conf 2024 — prestação de contas publicada",
      "+14.000 visualizações mensais no site",
    ],
    stats: [
      { label: "Encontros", value: "41", icon: "📅" },
      { label: "Mentorias", value: "31", icon: "🤝" },
      { label: "Horas", value: "23h", icon: "⏱️" },
      { label: "Alunos", value: "17", icon: "👩‍💻" },
      { label: "Discord", value: "501", icon: "💬" },
      { label: "Views/mês", value: "14k+", icon: "👁️" },
    ],
    highlights: [
      "41 encontros presenciais no CPM — primeiro ano com aulas presenciais",
      "14.000+ visualizações mensais no site",
    ],
  },
  {
    year: 2025,
    label: "Crescimento Contínuo",
    icon: "🚀",
    color: "primary",
    tag: "Impacto",
    description:
      "Retorno ao formato virtual com 95 mentorias, 66 horas e crescimento expressivo da comunidade.",
    items: [
      "1º Semestre: 15 alunos em aulas virtuais",
      "2º Semestre: 10 alunos em aulas virtuais",
      "95 mentorias realizadas totalizando 66 horas",
      "45 alunos mentorados individualmente",
      "DevPR Conf 2025 — prestação de contas publicada",
      "Cloud Native Maringá ingressa como comunidade parceira",
    ],
    stats: [
      { label: "Mentorias", value: "95", icon: "🤝" },
      { label: "Horas", value: "66h", icon: "⏱️" },
      { label: "Alunos", value: "45", icon: "👩‍💻" },
      { label: "Discord", value: "692", icon: "💬" },
      { label: "WhatsApp", value: "463", icon: "📱" },
      { label: "Views/mês", value: "7k+", icon: "👁️" },
    ],
    highlights: [
      "95 mentorias realizadas — recorde histórico do Codaqui",
      "692 membros no Discord — maior comunidade até agora",
    ],
  },
  {
    year: 2026,
    label: "Novos Horizontes",
    icon: "✨",
    color: "secondary",
    tag: "Em andamento",
    description:
      "Novas frentes de ensino com Educação Financeira e Introdução ao Python.",
    items: [
      "Curso de Educação Financeira iniciado",
      "Curso de Introdução ao Python iniciado",
      "692 membros no Discord",
      "463 membros no WhatsApp",
      "+7.000 visualizações mensais no site",
    ],
    stats: [
      { label: "Discord", value: "692", icon: "💬" },
      { label: "WhatsApp", value: "463", icon: "📱" },
      { label: "Views/mês", value: "7k+", icon: "👁️" },
      { label: "Cursos novos", value: "2", icon: "📖" },
    ],
    highlights: [
      "Diversificação do ensino: Educação Financeira além de programação",
    ],
  },
];
