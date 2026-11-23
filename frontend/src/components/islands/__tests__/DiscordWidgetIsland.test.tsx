import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import DiscordWidgetIsland from "../DiscordWidgetIsland";
import { renderWithMui } from "../../../test/render-mui";

describe("DiscordWidgetIsland semantics", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "server-1",
      name: "Codaqui",
      instant_invite: "https://discord.test/invite",
      channels: [],
      members: [],
      presence_count: 0,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses a level-two heading for the server title", async () => {
    renderWithMui(<DiscordWidgetIsland widgetUrl="https://discord.test/widget.json" />);

    expect(await screen.findByRole("heading", { level: 2, name: "Codaqui no Discord" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 5 })).not.toBeInTheDocument();
  });
});
