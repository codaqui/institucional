import React from "react";

export const mockAdminNavbarModule = {
  __esModule: true,
  default: () => <div data-testid="admin-navbar" />,
};

export const mockAdminPageContainerModule = {
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
};
