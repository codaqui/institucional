import { useEffect, useState } from "react";

interface PublicAnnouncement {
  id: string;
  text: string;
  severity: "info" | "success" | "warning" | "error";
  linkUrl: string | null;
  linkLabel: string | null;
  startsAt: string | null;
  endsAt: string | null;
}

interface AnnouncementSnapshot {
  generatedAt: string;
  announcements: PublicAnnouncement[];
}

const SEVERITY_LABELS = {
  info: "Informação",
  success: "Sucesso",
  warning: "Atenção",
  error: "Erro",
} as const;

export default function AnnouncementsBarIsland() {
  const [announcements, setAnnouncements] = useState<PublicAnnouncement[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/announcements/index.json")
      .then(async (response) => {
        if (!response.ok) throw new Error("Snapshot indisponível");
        return response.json() as Promise<AnnouncementSnapshot>;
      })
      .then((snapshot) => {
        if (active && Array.isArray(snapshot.announcements)) {
          setAnnouncements(snapshot.announcements);
        }
      })
      .catch(() => {
        if (active) setAnnouncements([]);
      });
    return () => {
      active = false;
    };
  }, []);

  if (announcements.length === 0) return null;

  return (
    <section className="announcements-bar" aria-label="Avisos institucionais">
      {announcements.map((announcement) => {
        const external = announcement.linkUrl?.includes("://") ?? false;
        return (
          <article
            key={announcement.id}
            className={`announcement announcement--${announcement.severity}`}
          >
            <span className="announcement__severity">
              {SEVERITY_LABELS[announcement.severity]}
            </span>
            <span className="announcement__text">{announcement.text}</span>
            {announcement.linkUrl && announcement.linkLabel ? (
              <a
                className="announcement__link"
                href={announcement.linkUrl}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
              >
                {announcement.linkLabel}
              </a>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
