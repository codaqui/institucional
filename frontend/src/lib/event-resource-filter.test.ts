// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  bindResourceFilterHistory,
  matchesResourceFilter,
  resolveResourceFilter,
  urlWithResourceFilter,
} from "./event-resource-filter";

describe("event resource filter", () => {
  it("reconhece somente recurso=c4p", () => {
    expect(resolveResourceFilter("?recurso=c4p")).toBe("c4p");
    expect(resolveResourceFilter("?recurso=outro")).toBe("all");
    expect(resolveResourceFilter("")).toBe("all");
  });

  it("atualiza recurso preservando source e hash", () => {
    const url = new URL("https://codaqui.dev/eventos?source=sympla%3Adevpr#agenda");
    expect(urlWithResourceFilter(url, "c4p").toString()).toBe(
      "https://codaqui.dev/eventos?source=sympla%3Adevpr&recurso=c4p#agenda",
    );
    expect(urlWithResourceFilter(url, "all").toString()).toBe(
      "https://codaqui.dev/eventos?source=sympla%3Adevpr#agenda",
    );
  });

  it("combina C4P e fonte por AND", () => {
    expect(matchesResourceFilter("c4p", { c4p: "true", sourceKey: "sympla:devpr" }, "sympla:devpr")).toBe(true);
    expect(matchesResourceFilter("c4p", { c4p: "false", sourceKey: "sympla:devpr" }, "sympla:devpr")).toBe(false);
    expect(matchesResourceFilter("all", { c4p: "false", sourceKey: "meetup:devpr" }, "sympla:devpr")).toBe(false);
  });

  it("restaura o recurso junto com a fonte no popstate", () => {
    const applied: string[] = [];
    const unbind = bindResourceFilterHistory((resource) => applied.push(resource), window);
    window.history.replaceState(null, "", "/eventos?source=sympla%3Adevpr&recurso=c4p");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(applied).toEqual(["c4p"]);
    unbind();
    window.history.replaceState(null, "", "/eventos");
  });
});
