import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { syncMemberBadges } from "./sync-member-badges.mjs";

async function temporaryOutput(t) {
  const outputDir = await mkdtemp(path.join(tmpdir(), "codaqui-member-badges-"));
  t.after(() => rm(outputDir, { recursive: true, force: true }));
  return outputDir;
}

async function apiServer(t, handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

function jsonHandler(payload) {
  return (request, response) => {
    assert.equal(request.url, "/hours/public");
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(payload));
  };
}

test("escapes hostile XML, honors independent visibility and removes obsolete badges", async (t) => {
  const outputDir = await temporaryOutput(t);
  await writeFile(path.join(outputDir, "hidden.svg"), "old-hidden");
  await writeFile(path.join(outputDir, "stale.svg"), "old-stale");
  await writeFile(path.join(outputDir, "keep.txt"), "untouched");
  const apiUrl = await apiServer(t, jsonHandler([
    {
      memberId: "visible-id",
      githubHandle: "visible",
      name: "Maria <script>alert(\"x\")</script> & 'Codaqui'",
      joinedAt: "2024-03-01T12:00:00.000Z",
      badge: true,
      totalHours: 12.5,
    },
    {
      memberId: "badge-only-id",
      githubHandle: "badge-only",
      name: "Somente Selo",
      badge: true,
    },
    {
      memberId: "hidden-id",
      githubHandle: "hidden",
      name: "hiddenHours",
      badge: false,
      totalHours: 99,
    },
  ]));

  await syncMemberBadges({ apiUrl, outputDir });

  const visible = await readFile(path.join(outputDir, "visible.svg"), "utf8");
  assert.match(visible, /role="img"/);
  assert.match(visible, /<title/);
  assert.match(visible, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; &apos;Codaqui&apos;/);
  assert.doesNotMatch(visible, /<script>/i);
  assert.match(visible, /Desde 2024/);
  assert.match(visible, /12,50 horas aprovadas/);
  assert.doesNotMatch(visible, /hiddenHours/);

  const badgeOnly = await readFile(path.join(outputDir, "badge-only.svg"), "utf8");
  assert.match(badgeOnly, /Somente Selo/);
  assert.doesNotMatch(badgeOnly, /horas aprovadas/);
  assert.doesNotMatch(badgeOnly, /Desde/);
  assert.equal(existsSync(path.join(outputDir, "hidden.svg")), false);
  assert.equal(existsSync(path.join(outputDir, "stale.svg")), false);
  assert.equal(await readFile(path.join(outputDir, "keep.txt"), "utf8"), "untouched");
  assert.deepEqual((await readdir(outputDir)).filter((file) => file.endsWith(".tmp")), []);
});

test("preserves every existing file when the API fails", async (t) => {
  const outputDir = await temporaryOutput(t);
  await writeFile(path.join(outputDir, "previous.svg"), "previous-content");
  const apiUrl = await apiServer(t, (_request, response) => {
    response.writeHead(503, { "Content-Type": "application/json" });
    response.end('{"message":"unavailable"}');
  });

  await assert.rejects(syncMemberBadges({ apiUrl, outputDir }), /503/);
  assert.equal(await readFile(path.join(outputDir, "previous.svg"), "utf8"), "previous-content");
  assert.deepEqual(await readdir(outputDir), ["previous.svg"]);
});

test("does not write or delete anything for an incomplete JSON response", async (t) => {
  const outputDir = await temporaryOutput(t);
  await writeFile(path.join(outputDir, "previous.svg"), "previous-content");
  const apiUrl = await apiServer(t, (_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end('[{"memberId":');
  });

  await assert.rejects(syncMemberBadges({ apiUrl, outputDir }));
  assert.equal(await readFile(path.join(outputDir, "previous.svg"), "utf8"), "previous-content");
  assert.deepEqual(await readdir(outputDir), ["previous.svg"]);
});

test("validates the complete payload before creating or removing badges", async (t) => {
  const outputDir = await temporaryOutput(t);
  await writeFile(path.join(outputDir, "previous.svg"), "previous-content");
  const apiUrl = await apiServer(t, jsonHandler([
    {
      memberId: "valid-id",
      githubHandle: "valid",
      name: "Válido",
      badge: true,
      totalHours: 10,
    },
    {
      memberId: "hostile-id",
      githubHandle: "../hostile",
      name: "Hostil",
      badge: true,
    },
  ]));

  await assert.rejects(syncMemberBadges({ apiUrl, outputDir }), /handle/i);
  assert.equal(existsSync(path.join(outputDir, "valid.svg")), false);
  assert.equal(await readFile(path.join(outputDir, "previous.svg"), "utf8"), "previous-content");
  assert.deepEqual(await readdir(outputDir), ["previous.svg"]);
});

test("restores overwritten and obsolete badges when an atomic rename fails", async (t) => {
  const outputDir = await temporaryOutput(t);
  await writeFile(path.join(outputDir, "visible.svg"), "old-visible");
  await writeFile(path.join(outputDir, "previous.svg"), "old-previous");
  const apiUrl = await apiServer(t, jsonHandler([
    { memberId: "visible-id", githubHandle: "visible", name: "Novo visível", badge: true, totalHours: 10 },
    { memberId: "other-id", githubHandle: "other", name: "Outro", badge: true },
  ]));
  const renameImpl = async (from, to) => {
    if (to.endsWith("other.svg")) throw new Error("simulated rename failure");
    return rename(from, to);
  };

  await assert.rejects(
    syncMemberBadges({ apiUrl, outputDir, renameImpl }),
    /simulated rename failure/,
  );
  assert.equal(await readFile(path.join(outputDir, "visible.svg"), "utf8"), "old-visible");
  assert.equal(await readFile(path.join(outputDir, "previous.svg"), "utf8"), "old-previous");
  assert.equal(existsSync(path.join(outputDir, "other.svg")), false);
  assert.deepEqual((await readdir(outputDir)).filter((file) => file.endsWith(".tmp")), []);
});
