import React from "react";

export function Redirect({ to }: { to: string }) {
  return <div data-testid="redirect" data-to={to} />;
}
