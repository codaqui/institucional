import * as docusaurusRouter from "@docusaurus/router";

interface RouterMockModule {
  __mockHistory: {
    push: jest.Mock;
    replace: jest.Mock;
  };
  __resetRouterMocks: () => void;
}

const routerMock = docusaurusRouter as unknown as RouterMockModule;

export const mockHistory = routerMock.__mockHistory;

export function resetRouterMocks(): void {
  routerMock.__resetRouterMocks();
}
