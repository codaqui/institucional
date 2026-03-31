import React from "react";
import styles from "./index.module.css";
import clsx from "clsx";

export type BadgeVariant =
  | "iniciante"
  | "intermediario"
  | "avancado"
  | "info"
  | "destaque"
  | "novo";

type Props = {
  label: string;
  variant?: BadgeVariant;
};

export default function Badge({ label, variant = "info" }: Props): React.JSX.Element {
  return (
    <span className={clsx(styles.badge, styles[variant])}>
      {label}
    </span>
  );
}
