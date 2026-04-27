export interface Project {
  emoji: string;
  title: string;
  description: string;
  href: string;
}

export const projects: Project[] = [
  {
    emoji: "🔒",
    title: "Boletim Diário de Segurança",
    description:
      "Todos os dias às 10h, um bot publica um boletim com notícias sobre segurança da informação.",
    href: "https://github.com/codaqui/boletim-diario-seguranca",
  },
  {
    emoji: "📊",
    title: "Laboratório de Data Analytics",
    description:
      "Laboratório para aprender Data Analytics, testando conceitos e brincando com Python.",
    href: "https://github.com/codaqui/dados",
  },
  {
    emoji: "🔑",
    title: "Secret Sharing",
    description:
      "Gerador e compartilhador de senhas para demonstrar a capacidade do PiPing Server.",
    href: "https://github.com/codaqui/secret-sharing",
  },
  {
    emoji: "🐙",
    title: "GitHub Action FreeDiskSpace",
    description:
      "GitHub Action para limpar o espaço em disco dos Runners SaaS do GitHub.",
    href: "https://github.com/endersonmenezes/free-disk-space",
  },
  {
    emoji: "🐙",
    title: "CODEOWNERS Super Power",
    description:
      "GitHub Action que aumenta o poder do arquivo CODEOWNERS dentro do GitHub.",
    href: "https://github.com/endersonmenezes/codeowners-superpowers",
  },
  {
    emoji: "🏗️",
    title: "Laboratório de Terraform",
    description: "Laboratório para estudar Terraform dentro da Codaqui.",
    href: "https://github.com/codaqui/terraform-organization",
  },
  {
    emoji: "🐙",
    title: "Tutor",
    description:
      "Aplicação para explorar Python e conceitos do mundo de Desenvolvimento.",
    href: "https://github.com/codaqui/tutor",
  },
  {
    emoji: "📈",
    title: "Copilot Dashboard",
    description:
      "Painel para visualizar e analisar dados de uso do GitHub Copilot.",
    href: "https://github.com/codaqui/copilot-dashboard",
  },
  {
    emoji: "🎭",
    title: "Backstage Lab",
    description:
      "Projeto para explorar o Backstage, a plataforma open source de developer portal da Spotify.",
    href: "https://github.com/codaqui/backstage",
  },
  {
    emoji: "🗣️",
    title: "Translate Talks",
    description:
      "Tradução em tempo real das talks de eventos para melhorar a acessibilidade para pessoas com deficiência auditiva.",
    href: "https://github.com/DeveloperParana/translate-talks",
  },
  {
    emoji: "🎲",
    title: "Sorteio App",
    description:
      "Aplicação para realizar sorteios nos eventos e meetups das comunidades.",
    href: "https://github.com/DeveloperParana/sorteio-app",
  },
];
