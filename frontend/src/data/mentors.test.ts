import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadMentorsIndex } from "./mentors";

const mentor = {
  id: "d0b899a1-50b4-4f4f-a153-f0b07aa12ad3",
  handle: "ana",
  name: "Ana",
  avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
  areas: ["DevOps"],
  focus: "Carreira",
  availability: [{ weekday: 1, startTime: "19:00", endTime: "20:00", timeZone: "America/Sao_Paulo" }],
};
const insights = { completed: 1, activeMentors: 1, areas: [{ area: "DevOps", mentors: 1, completed: 1 }], noShowRate: 0 };

describe("loadMentorsIndex", () => {
  let directory: string;
  let snapshotPath: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "codaqui-mentors-"));
    snapshotPath = join(directory, "index.json");
  });
  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  it("loads public mentors and aggregate insights", () => {
    writeFileSync(snapshotPath, JSON.stringify({ generatedAt: "2026-11-09T12:00:00.000Z", mentors: [mentor], insights }));
    expect(loadMentorsIndex(snapshotPath)).toEqual({ generatedAt: "2026-11-09T12:00:00.000Z", mentors: [mentor], insights });
  });

  it("returns an empty index when the snapshot is missing", () => {
    expect(loadMentorsIndex(snapshotPath)).toEqual({
      generatedAt: null, mentors: [],
      insights: { completed: 0, activeMentors: 0, areas: [], noShowRate: 0 },
    });
  });

  it.each([
    { ...mentor, memberId: "private" },
    { ...mentor, email: "private@example.test" },
    { ...mentor, sessions: [] },
  ])("discards the whole snapshot when a mentor contains private fields", (value) => {
    writeFileSync(snapshotPath, JSON.stringify({ generatedAt: "2026-11-09T12:00:00.000Z", mentors: [value], insights }));
    expect(loadMentorsIndex(snapshotPath).mentors).toEqual([]);
    expect(loadMentorsIndex(snapshotPath).generatedAt).toBeNull();
  });
});
