import type { Config } from "jest";

const config: Config = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/src"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
          module: "commonjs",
          moduleResolution: "node",
          esModuleInterop: true,
          allowJs: true,
          target: "ES2022",
          lib: ["ES2022", "DOM"],
          paths: {
            "@site/*": ["./*"],
            "@docusaurus/theme-common/internal": [
              "./src/__mocks__/docusaurus/theme-common-internal",
            ],
          },
        },
      },
    ],
  },
  moduleNameMapper: {
    "^@site/(.*)$": "<rootDir>/$1",
    "^@theme-original/(.*)$": "<rootDir>/src/__mocks__/theme-original/$1",
    "^@theme/(.*)$": "<rootDir>/src/__mocks__/theme/$1",
    "^@docusaurus/Link$": "<rootDir>/src/__mocks__/docusaurus/Link",
    "^@docusaurus/useDocusaurusContext$":
      "<rootDir>/src/__mocks__/docusaurus/useDocusaurusContext",
    "^@docusaurus/router$": "<rootDir>/src/__mocks__/docusaurus/router",
    "^@docusaurus/theme-common/internal$":
      "<rootDir>/src/__mocks__/docusaurus/theme-common-internal",
    "^@docusaurus/theme-common$": "<rootDir>/src/__mocks__/docusaurus/theme-common",
    "\\.module\\.(css|less|scss|sass)$": "<rootDir>/src/__mocks__/fileMock.js",
  },
  testPathIgnorePatterns: [
    "/node_modules/",
    "/backend/",
    "/build/",
    "/.docusaurus/",
  ],
  collectCoverageFrom: [
    "src/components/**/*.{ts,tsx}",
    "src/utils/**/*.{ts,tsx}",
    "src/theme/**/*.{ts,tsx}",
    "src/hooks/**/*.{ts,tsx}",
    "src/lib/**/*.{ts,tsx}",
    "!src/__mocks__/**",
    "!src/**/*.d.ts",
    "!src/**/*.test.{ts,tsx}",
  ],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transformIgnorePatterns: ["/node_modules/(?!@mui|@emotion)"],
  // Ratchet anti-regressão: o CI (pr-check.yml) roda com --coverage e falha
  // se a cobertura global cair abaixo destes pisos. Suba os valores sempre
  // que a cobertura real subir (baseline 2026-09: ~66% stmts/lines, ~68% branches).
  coverageThreshold: {
    global: {
      statements: 60,
      branches: 60,
      functions: 50,
      lines: 60,
    },
  },
};

export default config;
