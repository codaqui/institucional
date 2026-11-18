import { describe, expect, it } from "vitest";
import type { PublicMentor } from "../data/mentors";
import { findMentorByQuery } from "./mentor-query";

const mentors = [
  { id: "mentor-1", handle: "Ana", name: "Ana", avatarUrl: "avatar", areas: ["Dev"], focus: null, availability: [] },
  { id: "mentor-2", handle: "bia", name: "Bia", avatarUrl: "avatar", areas: ["Dev"], focus: null, availability: [] },
] satisfies PublicMentor[];

describe("findMentorByQuery", () => {
  it.each([null, "", "unknown"])("returns no mentor for %s", (value) => {
    expect(findMentorByQuery(mentors, value)).toBeNull();
  });

  it("matches a public profile id exactly", () => {
    expect(findMentorByQuery(mentors, "mentor-2")?.name).toBe("Bia");
  });

  it("matches a handle case-insensitively", () => {
    expect(findMentorByQuery(mentors, "aNa")?.id).toBe("mentor-1");
  });
});
