import { fileURLToPath } from "node:url";
import { build } from "vite";
import { describe, expect, it } from "vitest";

async function findNodeBuiltinWarnings(entry: string): Promise<string[]> {
  const warnings: string[] = [];
  await build({
    root: fileURLToPath(new URL("../..", import.meta.url)),
    logLevel: "silent",
    build: {
      write: false,
      rollupOptions: {
        input: fileURLToPath(new URL(entry, import.meta.url)),
        onwarn(warning) {
          warnings.push(warning.message);
        },
      },
    },
  });
  return warnings.filter((warning) => /node:(fs|path|url)/.test(warning));
}

describe("browser client dependency graphs", () => {
  for (const [name, entry] of [
    ["events-api", "./events-api.ts"],
    ["overrides admin", "../components/islands/admin/overrides/OverridesApp.tsx"],
  ]) {
    it(`keeps Node.js built-ins out of ${name}`, async () => {
      expect(await findNodeBuiltinWarnings(entry)).toEqual([]);
    }, 30_000);
  }
});
