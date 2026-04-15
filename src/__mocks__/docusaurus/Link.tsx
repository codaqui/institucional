import React from "react";

export default function Link({
  to,
  href,
  children,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }) {
  return (
    <a href={to ?? href} {...rest}>
      {children}
    </a>
  );
}
