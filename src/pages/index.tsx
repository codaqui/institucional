import React from "react";
import clsx from "clsx";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import styles from "./index.module.css";

function HeroBanner() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx("hero hero--primary", styles.heroBanner)}>
      <div className="container">
        <img
          src="/img/logo_blk.png"
          alt="Codaqui Logo"
          className={styles.heroLogo}
        />
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/participe/estudar"
          >
            #QueroEstudar
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/participe/apoiar"
          >
            #QueroApoiar
          </Link>
        </div>
      </div>
    </header>
  );
}

type FeatureItem = {
  title: string;
  emoji: string;
  description: string;
};

const features: FeatureItem[] = [
  {
    title: "Autonomia no aprendizado",
    emoji: "📚",
    description:
      "Os alunos percorrem de forma autônoma algumas trilhas de aprendizado criadas com a ajuda de especialistas voluntários e semanalmente encontram um mentor para atividades práticas.",
  },
  {
    title: "Resolução de problemas reais",
    emoji: "🛠️",
    description:
      "Além dos projetos pessoais desenvolvido ao longo do curso, os alunos podem participar de projetos reais, de desenvolvimento de serviços e produtos para outras organizações sem fins lucrativos.",
  },
  {
    title: "Acesso a computador e internet",
    emoji: "💻",
    description:
      "Incentivamos nossos membros a ocupar espaços públicos, estabelecendo parcerias para que todos tenham acesso a computador, internet e uma estação de estudo.",
  },
  {
    title: "Comunidade de Comunidades",
    emoji: "🤝",
    description:
      "Além de todos esses benefícios, a Codaqui integra outras comunidades em sua estrutura, proporcionando oportunidades adicionais de networking e compartilhamento de conhecimento.",
  },
];

function Feature({ title, emoji, description }: FeatureItem) {
  return (
    <div className={clsx("col col--6")}>
      <div className={styles.featureCard}>
        <h3>
          {emoji} {title}
        </h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

type CommunityItem = {
  name: string;
  logo: string;
  link: string;
};

const communities: CommunityItem[] = [
  {
    name: "DevParaná",
    logo: "https://avatars.githubusercontent.com/u/15199454?s=200&v=4",
    link: "https://github.com/DeveloperParana",
  },
  {
    name: "CamposTech",
    logo: "/img/campostech.svg",
    link: "https://www.instagram.com/campostechpg",
  },
  {
    name: "Elas no Código",
    logo: "/img/elasnocodigo.svg",
    link: "https://www.instagram.com/elasnocodigo",
  },
  {
    name: "TI Social",
    logo: "/img/tisocial.png",
    link: "https://www.instagram.com/tisocialmaringa",
  },
];

function CommunitySection() {
  return (
    <section className={styles.communitySection}>
      <div className="container">
        <h2>🤝 Comunidades Participantes</h2>
        <div className="community-grid">
          {communities.map((community) => (
            <a
              key={community.name}
              href={community.link}
              target="_blank"
              rel="noopener noreferrer"
              className="community-item"
            >
              <img src={community.logo} alt={`Logo ${community.name}`} />
              <strong>{community.name}</strong>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function LinksSection() {
  return (
    <section className={styles.linksSection}>
      <div className="container">
        <h2>🔗 Links Importantes</h2>
        <div className={styles.linksGrid}>
          <a
            href="https://chat.whatsapp.com/IvzONDeglw55ySBD71F4Up"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.linkCard}
          >
            <h3>📱 WhatsApp</h3>
            <p>Entre no nosso grupo do WhatsApp</p>
          </a>
          <a
            href="https://discord.com/invite/xuTtxqCPpz"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.linkCard}
          >
            <h3>💬 Discord</h3>
            <p>Participe do nosso servidor do Discord</p>
          </a>
        </div>
      </div>
    </section>
  );
}

export default function Home(): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title="Página Inicial"
      description={siteConfig.tagline}
    >
      <HeroBanner />
      <main>
        <section className={styles.features}>
          <div className="container">
            <h2>🎓 Nossa solução</h2>
            <div className="row">
              {features.map((props, idx) => (
                <Feature key={idx} {...props} />
              ))}
            </div>
          </div>
        </section>
        <CommunitySection />
        <LinksSection />
      </main>
    </Layout>
  );
}
