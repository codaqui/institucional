// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  bindSourceFilterHistory,
  resolveSourceFilter,
  shouldApplySourceFilter,
  urlWithSourceFilter,
} from "./event-source-filter";

describe("shouldApplySourceFilter", () => {
  it("aplica filtro com sourceKey válido", () => {
    expect(
      shouldApplySourceFilter(
        new URLSearchParams("source=meetup:devparana"),
        new Set(["meetup:devparana"]),
      ),
    ).toBe(true);
  });

  it("sem query: não filtra", () => {
    expect(shouldApplySourceFilter(new URLSearchParams(), new Set())).toBe(false);
  });

  it("sourceKey desconhecido: não filtra (fallback = todos)", () => {
    expect(
      shouldApplySourceFilter(new URLSearchParams("source=inexistente"), new Set()),
    ).toBe(false);
  });

  it("sourceKey vazio: não filtra", () => {
    expect(
      shouldApplySourceFilter(new URLSearchParams("source="), new Set(["a"])),
    ).toBe(false);
  });
});

describe("resolveSourceFilter", () => {
  it("retorna a fonte conhecida presente na URL", () => {
    expect(
      resolveSourceFilter("?source=discord%3Acodaqui", new Set(["discord:codaqui"])),
    ).toBe("discord:codaqui");
  });

  it("retorna todos para fonte ausente ou desconhecida", () => {
    expect(resolveSourceFilter("", new Set(["discord:codaqui"]))).toBe("all");
    expect(resolveSourceFilter("?source=inexistente", new Set(["discord:codaqui"]))).toBe("all");
  });
});

describe("urlWithSourceFilter", () => {
  it("atualiza somente source e preserva os demais parâmetros e o hash", () => {
    const url = new URL("https://codaqui.dev/eventos?origem=home#agenda");

    expect(
      urlWithSourceFilter(url, "discord:codaqui", new Set(["discord:codaqui"])).toString(),
    ).toBe("https://codaqui.dev/eventos?origem=home&source=discord%3Acodaqui#agenda");
  });

  it("remove source ao selecionar todos", () => {
    const url = new URL("https://codaqui.dev/eventos?source=discord%3Acodaqui&origem=home#agenda");

    expect(urlWithSourceFilter(url, "all", new Set(["discord:codaqui"])).toString()).toBe(
      "https://codaqui.dev/eventos?origem=home#agenda",
    );
  });
});

describe("bindSourceFilterHistory", () => {
  it("restaura o filtro da URL ao receber popstate", () => {
    const applied: string[] = [];
    const unbind = bindSourceFilterHistory(
      new Set(["meetup:devparana"]),
      (key) => applied.push(key),
      window,
    );

    window.history.replaceState(null, "", "/eventos?source=meetup%3Adevparana");
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(applied).toEqual(["meetup:devparana"]);
    unbind();
    window.history.replaceState(null, "", "/eventos");
  });
});
