import React from "react";
import Layout from "@theme/Layout";
import styles from "./equipe.module.css";

type Member = {
  name: string;
  role: string;
  avatar: string;
  linkedin?: string;
  github?: string;
};

const members: Member[] = [
  { name: "Enderson Menezes", role: "Fundador", avatar: "https://avatars.githubusercontent.com/u/11020807?v=4", linkedin: "https://www.linkedin.com/in/endersonmenezes/", github: "https://github.com/endersonmenezes" },
  { name: "Thainara Furforo", role: "Voluntária", avatar: "https://avatars.githubusercontent.com/u/92865769?v=4", linkedin: "https://www.linkedin.com/in/thainarafurforo/", github: "https://github.com/thaifurforo" },
  { name: "Ana Carolyne", role: "Voluntária", avatar: "https://avatars.githubusercontent.com/u/111382055?v=4", linkedin: "https://www.linkedin.com/in/ana-carolyne-%F0%9F%8F%B3%EF%B8%8F%E2%80%8D%F0%9F%8C%88-952b9314b/", github: "https://github.com/anadevti" },
  { name: "Guilherme Siquinelli", role: "Mentor", avatar: "https://avatars.githubusercontent.com/u/5638096?v=4", linkedin: "https://www.linkedin.com/in/guilherme-siquinelli/", github: "https://github.com/guiseek" },
  { name: "Matheus Luis", role: "Mentor", avatar: "https://avatars.githubusercontent.com/u/66440299?v=4", linkedin: "https://www.linkedin.com/in/causticroot/", github: "https://github.com/causticsudo" },
  { name: "Estevan Bartmann Silveira", role: "Voluntário", avatar: "https://avatars.githubusercontent.com/u/53413670?v=4", linkedin: "https://www.linkedin.com/in/estevan-silveira/", github: "https://github.com/estevanbs" },
  { name: "Ivo Batistela", role: "Mentor", avatar: "https://avatars.githubusercontent.com/u/5186894?v=4", linkedin: "https://www.linkedin.com/in/byivo/", github: "https://github.com/byivo" },
  { name: "Elina Torres", role: "Voluntária", avatar: "https://avatars.githubusercontent.com/u/154446327?v=4", linkedin: "https://www.linkedin.com/in/elina-torres/", github: "https://github.com/elinatorresn" },
  { name: "Adonias Vitorio", role: "Voluntário", avatar: "https://avatars.githubusercontent.com/adoniasvitorio", linkedin: "https://www.linkedin.com/in/adoniasvitorio/", github: "https://github.com/adoniasvitorio" },
  { name: "Kátia Cibele", role: "Voluntária", avatar: "https://avatars.githubusercontent.com/katiacih", linkedin: "https://www.linkedin.com/in/k%C3%A1tia-cibele-r1b31ro-/", github: "https://github.com/katiacih" },
];

function MemberCard({ name, role, avatar, linkedin, github }: Member) {
  return (
    <div className={styles.card}>
      <img src={avatar} alt={`Foto de ${name}`} className={styles.avatar} loading="lazy" />
      <div className={styles.info}>
        <h3 className={styles.name}>{name}</h3>
        <span className={styles.role}>{role}</span>
        <div className={styles.links}>
          {linkedin && (
            <a href={linkedin} target="_blank" rel="noopener noreferrer" className={styles.link} aria-label={`LinkedIn de ${name}`}>
              LinkedIn
            </a>
          )}
          {github && (
            <a href={github} target="_blank" rel="noopener noreferrer" className={styles.link} aria-label={`GitHub de ${name}`}>
              GitHub
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EquipePage(): React.JSX.Element {
  return (
    <Layout title="Equipe" description="Conheça os voluntários e mentores da Codaqui">
      <main>
        <div className={styles.hero}>
          <div className="container">
            <h1 className={styles.heroTitle}>Quem somos</h1>
            <p className={styles.heroSub}>
              Somos voluntários apaixonados por tecnologia e educação, dedicados a
              democratizar o acesso ao aprendizado para jovens de todo o Brasil.
            </p>
          </div>
        </div>

        <section className="container margin-vert--xl">
          <div className={styles.missionBox}>
            <span className={styles.missionIcon}>🎯</span>
            <p>
              Nosso objetivo é quebrar barreiras e levar o ensino tecnológico a todos.
              A Codaqui é uma associação sem fins lucrativos dedicada a apoiar jovens e
              comunidades, promovendo o acesso à tecnologia para aqueles que mais necessitam.
            </p>
          </div>

          <h2 className={styles.sectionTitle}>Voluntários & Mentores</h2>
          <div className={styles.grid}>
            {members.map((m) => (
              <MemberCard key={m.name} {...m} />
            ))}
          </div>
        </section>
      </main>
    </Layout>
  );
}
