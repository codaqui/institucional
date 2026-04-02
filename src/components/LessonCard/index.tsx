import React from "react";
import Link from "@docusaurus/Link";
import styles from "./index.module.css";
import clsx from "clsx";

type Props = {
  readonly title: string;
  readonly description: string;
  readonly to: string;
  readonly emoji?: string;
  readonly badge?: string;
  readonly className?: string;
};

export default function LessonCard({
  title,
  description,
  to,
  emoji = "📄",
  badge,
  className,
}: Readonly<Props>): React.JSX.Element {
  return (
    <Link to={to} className={clsx(styles.card, className)}>
      <span className={styles.emoji}>{emoji}</span>
      <div className={styles.content}>
        <span className={styles.title}>{title}</span>
        {badge && <span className={styles.badge}>{badge}</span>}
        <p className={styles.description}>{description}</p>
      </div>
      <span className={styles.arrow}>→</span>
    </Link>
  );
}
