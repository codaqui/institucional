import React from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <div data-testid="layout">{children}</div>;
}
