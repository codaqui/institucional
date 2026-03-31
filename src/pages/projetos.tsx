import React from "react";
import Layout from "@theme/Layout";
import styles from "./projetos.module.css";

type Project = {
  emoji: string;
  title: string;
  description: string;
  href: string;
};

const projects: Project[] = [
  { emoji: "🔒", title: "Boletim Diário de Segurança", description: "Todos os dias às 10h, um bot publica um boletim com notícias sobre segurança da informação.", href: "https://github.com/codaqui/boletim-diario-seguranca" },
  { emoji: "📊", title: "Laboratório de Data Analytics", description: "Laboratório para aprender Data Analytics, testando conceitos e brincando com Python.", href: "https://github.com/codaqui/dados" },
  { emoji: "🔑", title: "Secret Sharing", description: "Gerador e compartilhador de senhas para demonstrar a capacidade do PiPing Server.", href: "https://github.com/codaqui/secret-sharing" },
  { emoji: "🐙", title: "GitHub Action FreeDiskSpace", description: "GitHub Action para limpar o espaço em disco dos Runners SaaS do GitHub.", href: "https://github.com/endersonmenezes/free-disk-space" },
  { emoji: "🐙", title: "CODEOWNERS Super Power", description: "GitHub Action que aumenta o poder do arquivo CODEOWNERS dentro do GitHub.", href: "https://github.com/endersonmenezes/codeowners-superpowers" },
  { emoji: "🏗️", title: "Laboratório de Terraform", description: "Laboratório para estudar Terraform dentro da Codaqui.", href: "https://github.com/codaqui/terraform-organization" },
  { emoji: "🐙", title: "Tutor", description: "Aplicação para explorar Python e conceitos do mundo de Desenvolvimento.", href: "https://github.com/codaqui/tutor" },
  { emoji: "📈", title: "Copilot Dashboard", description: "Painel para visualizar e analisar dados de uso do GitHub Copilot.", href: "https://github.com/codaqui/copilot-dashboard" },
  { emoji: "🎭", title: "Backstage Lab", description: "Projeto para explorar o Backstage, a plataforma open source de developer portal da Spotify.", href: "https://github.com/codaqui/backstage" },
];

function ProjectCard({ emoji, title, description, href }: Project) {
  return (
    <div className={styles.card}>
      <span className={styles.emoji}>{emoji}</span>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
      <a href={href} target="_blank" rel="noopener noreferrer" className={styles.button}>
        Ver no GitHub →
      </a>
    </div>
  );
}

export default function ProjetosPage(): React.JSX.Element {
  return (
    <Layout title="Projetos" description="Projetos mantidos pela comunidade Codaqui">
      <main className="container margin-vert--xl">
        <div className="text--center margin-bottom--xl">
          <h1>Projetos 🛠️</h1>
          <p className={styles.subtitle}>
            A Codaqui é uma comunidade viva. Abaixo estão projetos que mantemos — em laboratório
            ou em produção — abertos para contribuição.
          </p>
        </div>

        <div className={styles.howTo}>
          <h2>Como contribuir?</h2>
          <ol>
            <li>Escolha um projeto que desperte seu interesse.</li>
            <li>Abra uma <em>issue</em> descrevendo o que gostaria de fazer.</li>
            <li>Aguarde o ok da equipe e mãos à obra!</li>
          </ol>
        </div>

        <div className={styles.grid}>
          {projects.map((p) => (
            <ProjectCard key={p.title} {...p} />
          ))}
        </div>
      </main>
    </Layout>
  );
}
