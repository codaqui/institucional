import React from "react";

interface NavbarItemProps {
  label?: string;
  to?: string;
  mobile?: boolean;
  activeBaseRegex?: string;
  onClick?: () => void;
  [key: string]: unknown;
}

export default function NavbarItem({ label, to, onClick }: Readonly<NavbarItemProps>) {
  return (
    <li className="menu__list-item">
      <a className="menu__link" href={to} onClick={onClick}>
        {label}
      </a>
    </li>
  );
}
