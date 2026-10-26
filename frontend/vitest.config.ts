import { defineConfig } from "vitest/config";

export default defineConfig({
  // O tsconfig do Astro usa jsx: "preserve" (o @astrojs/react cuida do JSX no
  // build); no Vitest, esbuild defaulta para o runtime clássico — força o
  // runtime automático do React para os testes de ilhas.
  esbuild: {
    jsx: "automatic",
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
    environmentMatchGlobs: [["src/**/*.test.tsx", "jsdom"]],
    // O jsdom só expõe `window.localStorage` para origens não-opacas — o
    // setup.ts depende disso para substituir o localStorage nativo do Node.
    environmentOptions: {
      jsdom: {
        url: "http://localhost/",
      },
    },
    setupFiles: ["./src/test/setup.ts"],
  },
});
