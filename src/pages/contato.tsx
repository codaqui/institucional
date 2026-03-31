import React from "react";
import Layout from "@theme/Layout";
import styles from "./contato.module.css";

type Channel = {
  emoji: string;
  name: string;
  description: string;
  href: string;
  cta: string;
};

const channels: Channel[] = [
  { emoji: "📧", name: "E-mail", description: "Nos envie uma mensagem diretamente.", href: "mailto:contato@codaqui.dev", cta: "contato@codaqui.dev" },
  { emoji: "📸", name: "Instagram", description: "Acompanhe nossa rotina e novidades.", href: "https://www.instagram.com/codaqui.dev/", cta: "@codaqui.dev" },
  { emoji: "💼", name: "LinkedIn", description: "Conecte-se com nossa equipe.", href: "https://www.linkedin.com/company/codaqui/", cta: "Codaqui" },
  { emoji: "🐦", name: "Twitter / X", description: "Fique por dentro das atualizações.", href: "https://twitter.com/codaquidev", cta: "@codaquidev" },
  { emoji: "💬", name: "Discord", description: "Converse com alunos e mentores ao vivo.", href: "https://discord.com/invite/xuTtxqCPpz", cta: "Entrar no servidor" },
  { emoji: "📱", name: "WhatsApp", description: "Receba avisos e novidades do projeto.", href: "https://chat.whatsapp.com/IvzONDeglw55ySBD71F4Up", cta: "Entrar no grupo" },
];

function ChannelCard({ emoji, name, description, href, cta }: Channel) {
  const isExternal = href.startsWith("http");
  return (
    <a
      href={href}
      className={styles.card}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
    >
      <span className={styles.emoji}>{emoji}</span>
      <div className={styles.body}>
        <strong className={styles.name}>{name}</strong>
        <span className={styles.desc}>{description}</span>
      </div>
      <span className={styles.cta}>{cta} →</span>
    </a>
  );
}

export default function ContatoPage(): React.JSX.Element {
  return (
    <Layout title="Contato" description="Entre em contato com a Codaqui">
      <main className="container margin-vert--xl">
        <div className="text--center margin-bottom--xl">
          <h1>Fale com a gente 👋</h1>
          <p className={styles.subtitle}>
            Escolha o canal que preferir — estamos disponíveis em várias plataformas.
          </p>
        </div>
        <div className={styles.grid}>
          {channels.map((c) => (
            <ChannelCard key={c.name} {...c} />
          ))}
        </div>
      </main>
    </Layout>
  );
}
