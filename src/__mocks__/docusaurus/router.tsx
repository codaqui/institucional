import React from "react";

export function Redirect({ to }: Readonly<{ to: string }>) {
  return <div data-testid="redirect" data-to={to} />;
}
