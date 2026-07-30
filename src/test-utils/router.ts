import * as docusaurusRouter from "@docusaurus/router";

interface RouterMockModule {
  __mockHistory: {
    push: jest.Mock;
    replace: jest.Mock;
  };
  __resetRouterMocks: () => void;
  __setMockPathname: (pathname: string) => void;
  __setMockSearch: (search: string) => void;
}

const routerMock = docusaurusRouter as unknown as RouterMockModule;

export const mockHistory = routerMock.__mockHistory;

export function resetRouterMocks(): void {
  routerMock.__resetRouterMocks();
}

export function setMockPathname(pathname: string): void {
  routerMock.__setMockPathname(pathname);
}

export function setMockSearch(search: string): void {
  routerMock.__setMockSearch(search);
}
