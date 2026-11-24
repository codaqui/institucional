import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./sync-social-stats.mjs", import.meta.url));

test("a changed manual baseline replaces the previous fallback count", async () => {
  const root = await mkdtemp(join(tmpdir(), "codaqui-social-sync-"));
  await mkdir(join(root, "frontend/src/data"), { recursive: true });
  await mkdir(join(root, "static/social-stats"), { recursive: true });
  await mkdir(join(root, "static/events"), { recursive: true });
  await writeFile(join(root, "social-stats.config.json"), '{"entities":[]}');
  await writeFile(join(root, "static/events/index.json"), '{"events":[]}');
  await writeFile(join(root, "frontend/src/data/communities.ts"), "export const communities = [];\n");
  await writeFile(join(root, "frontend/src/data/social.ts"), `
export const codaquiSocialProfiles = [
  {
    platform: "whatsapp",
    handle: "Grupo Codaqui",
    url: "https://chat.whatsapp.com/test",
    countLabel: "participantes",
    baselineCount: 519,
  },
];
`);
  await writeFile(join(root, "static/social-stats/index.json"), JSON.stringify({
    profiles: [{ entityId: "codaqui", platform: "whatsapp", baselineCount: 0, count: 0, fetchedAt: null }],
  }));

  execFileSync(process.execPath, [script], { cwd: root, stdio: "pipe" });
  const snapshot = JSON.parse(await readFile(join(root, "static/social-stats/index.json"), "utf8"));
  assert.equal(snapshot.profiles[0].count, 519);
  assert.equal(snapshot.profiles[0].baselineCount, 519);
});
