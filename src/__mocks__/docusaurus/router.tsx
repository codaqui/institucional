import React from "react";

interface MockHistory {
  push: jest.Mock;
  replace: jest.Mock;
}

let pathname = "/";

export const __mockHistory: MockHistory = {
  push: jest.fn(),
  replace: jest.fn(),
};

export function __setMockPathname(nextPathname: string): void {
  pathname = nextPathname;
}

export function __resetRouterMocks(): void {
  __mockHistory.push.mockReset();
  __mockHistory.replace.mockReset();
  pathname = "/";
}

export function Redirect({ to }: Readonly<{ to: string }>) {
  return <div data-testid="redirect" data-to={to} />;
}

export function useLocation(): { pathname: string } {
  return { pathname };
}

export function useHistory(): MockHistory {
  return __mockHistory;
}
