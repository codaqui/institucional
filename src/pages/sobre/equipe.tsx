import React from "react";
import Layout from "@theme/Layout";
import styles from "./equipe.module.css";

type Member = {
  name: string;
  role: string;
  avatar: string;
  specialty?: string;
  linkedin?: string;
  github?: string;
};

const diretoria: Member[] = [
  { name: "Enderson Menezes", role: "Presidente", avatar: "https://avatars.githubusercontent.com/u/11020807?v=4", linkedin: "https://www.linkedin.com/in/endersonmenezes/", github: "https://github.com/endersonmenezes" },
  { name: "Everton Emilio", role: "Vice-Presidente", avatar: "https://github.com/ghost.png" },
  { name: "Gustavo Hamerschimidt", role: "Secretário", avatar: "https://github.com/ghost.png" },
  { name: "Ivo Batistela", role: "Tesoureiro", avatar: "https://avatars.githubusercontent.com/u/5186894?v=4", linkedin: "https://www.linkedin.com/in/byivo/", github: "https://github.com/byivo" },
];

const membros: Member[] = [
  { name: "Ana Carolyne", role: "Membra", avatar: "https://avatars.githubusercontent.com/u/111382055?v=4", linkedin: "https://www.linkedin.com/in/ana-carolyne-%F0%9F%8F%B3%EF%B8%8F%E2%80%8D%F0%9F%8C%88-952b9314b/", github: "https://github.com/anadevti" },
  { name: "Elina Torres", role: "Membra", avatar: "https://avatars.githubusercontent.com/u/154446327?v=4", linkedin: "https://www.linkedin.com/in/elina-torres/", github: "https://github.com/elinatorresn" },
  { name: "Fernando Fabricio", role: "Membro", avatar: "https://github.com/ghost.png" },
  { name: "Gabriel Passos", role: "Membro", avatar: "https://github.com/ghost.png" },
  { name: "Geovane Norbert", role: "Membro", avatar: "https://github.com/ghost.png" },
  { name: "Matheus Luis", role: "Membro", avatar: "https://avatars.githubusercontent.com/u/66440299?v=4", linkedin: "https://www.linkedin.com/in/causticroot/", github: "https://github.com/causticsudo" },
  { name: "Renan Ceratto", role: "Membro", avatar: "https://github.com/ghost.png" },
  { name: "Thainara Furforo", role: "Membra", avatar: "https://avatars.githubusercontent.com/u/92865769?v=4", linkedin: "https://www.linkedin.com/in/thainarafurforo/", github: "https://github.com/thaifurforo" },
];

const alumni: Member[] = [
  { name: "Diana Carvalho", role: "Fundadora", avatar: "https://avatars.githubusercontent.com/Divcarvalho?v=4", linkedin: "https://www.linkedin.com/in/diana-carvalho-46b63998/", github: "https://github.com/Divcarvalho" },
];

const mentores: Member[] = [
  { name: "Enderson Menezes", role: "Mentor", specialty: "DevOps e Iniciantes", avatar: "https://avatars.githubusercontent.com/u/11020807?v=4", linkedin: "https://www.linkedin.com/in/endersonmenezes/", github: "https://github.com/endersonmenezes" },
  { name: "Guilherme Siquinelli", role: "Mentor", specialty: "Frontend e Arquitetura", avatar: "https://avatars.githubusercontent.com/u/5638096?v=4", linkedin: "https://www.linkedin.com/in/guilherme-siquinelli/", github: "https://github.com/guiseek" },
  { name: "Matheus Luis", role: "Mentor", specialty: "Backend e .NET", avatar: "https://avatars.githubusercontent.com/u/66440299?v=4", linkedin: "https://www.linkedin.com/in/causticroot/", github: "https://github.com/causticsudo" },
  { name: "Ivo Batistela", role: "Mentor", specialty: "Como organizar eventos na sua cidade", avatar: "https://avatars.githubusercontent.com/u/5186894?v=4", linkedin: "https://www.linkedin.com/in/byivo/", github: "https://github.com/byivo" },
  { name: "Renan Ceratto", role: "Mentor", specialty: "Empreendedorismo", avatar: "https://github.com/ghost.png" },
];

function MemberCard({ name, role, specialty, avatar, linkedin, github }: Member) {
  return (
    <div className={styles.card}>
      <img src={avatar} alt={`Foto de ${name}`} className={styles.avatar} loading="lazy" />
      <div className={styles.info}>
        <h3 className={styles.name}>{name}</h3>
        <span className={styles.role}>{role}</span>
        {specialty && <span className={styles.specialty}>{specialty}</span>}
        <div className={styles.links}>
          {linkedin && linkedin !== "#" && (
            <a href={linkedin} target="_blank" rel="noopener noreferrer" className={styles.link} aria-label={`LinkedIn de ${name}`}>
              LinkedIn
            </a>
          )}
          {github && github !== "#" && (
            <a href={github} target="_blank" rel="noopener noreferrer" className={styles.link} aria-label={`GitHub de ${name}`}>
              GitHub
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, members, description, id }: { title: string; members: Member[]; description?: string; id?: string }) {
  return (
    <section id={id} className="margin-bottom--xl">
      <h2 className={styles.sectionTitle}>{title}</h2>
      {description && <p className={styles.sectionDesc}>{description}</p>}
      <div className={styles.grid}>
        {members.map((m) => (
          <MemberCard key={m.name + m.role} {...m} />
        ))}
      </div>
    </section>
  );
}

export default function EquipePage(): React.JSX.Element {
  return (
    <Layout title="Equipe" description="Conheça a diretoria, membros, mentores e alumni da Codaqui">
      <main>
        <div className={styles.hero}>
          <div className="container">
            <h1 className={styles.heroTitle}>Quem somos</h1>
            <p className={styles.heroSub}>
              Nosso objetivo é quebrar barreiras e democratizar o acesso à tecnologia.
              A Codaqui é uma associação sem fins lucrativos (CNPJ 44.593.429/0001-05) que atua como
              guarda-chuva de comunidades tech, apoiando participantes, mentores e projetos que promovem
              inclusão e colaboração.
            </p>
          </div>
        </div>

        <div className="container margin-vert--xl">
          <Section
            title="Diretoria"
            description="Responsável pela gestão, representação legal e prestação de contas da associação."
            members={diretoria}
          />
          <Section title="Membros" members={membros} />
          <Section
            title="Alumni"
            description="Pessoas que fizeram parte da associação e contribuíram para sua história e fundação."
            members={alumni}
          />
          <Section
            id="mentores"
            title="Mentores"
            description="Nossos mentores participam do programa #QueroMentoria, oferecendo mentorias individuais e aulas para quem está iniciando na tecnologia."
            members={mentores}
          />
        </div>
      </main>
    </Layout>
  );
}
