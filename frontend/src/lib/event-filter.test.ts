// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { initEventFilters, resolveEventSourceFilter } from "./event-filter";

describe("resolveEventSourceFilter", () => {
  const sourceKeys = ["discord:codaqui", "meetup:devparana"];

  it("resolves an encoded source key from the query string", () => {
    expect(
      resolveEventSourceFilter("?source=discord%3Acodaqui", sourceKeys),
    ).toBe("discord:codaqui");
  });

  it("defaults to all when source is missing or unknown", () => {
    expect(resolveEventSourceFilter("", sourceKeys)).toBe("all");
    expect(resolveEventSourceFilter("?source=unknown", sourceKeys)).toBe("all");
    expect(resolveEventSourceFilter("?source=", sourceKeys)).toBe("all");
  });
});

describe("initEventFilters", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/eventos");
    document.body.innerHTML = `
      <script id="events-stats" type="application/json">
        {
          "all": { "total": 2, "recurring": 0, "rsvps": 3, "label": null },
          "discord:codaqui": { "total": 1, "recurring": 0, "rsvps": 2, "label": "Discord Codaqui" },
          "meetup:devparana": { "total": 1, "recurring": 0, "rsvps": 1, "label": "Dev Paraná no Meetup" }
        }
      </script>
      <button data-filter="all" aria-pressed="true"></button>
      <button data-filter="discord:codaqui" aria-pressed="false"></button>
      <button data-filter="meetup:devparana" aria-pressed="false"></button>
      <p id="stat-total">2</p>
      <p id="stat-recurring">0</p>
      <p id="stat-rsvps">3</p>
      <p id="filter-desc"></p>
      <section id="featured-section"></section>
      <p id="upcoming-empty"></p>
      <p id="past-empty"></p>
      <div id="past-load-more"><button></button></div>
      <div data-event-card data-section="upcoming" data-source-key="discord:codaqui"></div>
      <div data-event-card data-section="upcoming" data-source-key="meetup:devparana"></div>
    `;
  });

  it("applies the valid query-string source on initialization", () => {
    initEventFilters("?source=discord%3Acodaqui");

    expect(document.querySelector('[data-filter="discord:codaqui"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector('[data-filter="all"]')?.getAttribute("aria-pressed")).toBe("false");
    expect(
      document.querySelector('[data-source-key="discord:codaqui"]')?.classList.contains("hidden-by-filter"),
    ).toBe(false);
    expect(
      document.querySelector('[data-source-key="meetup:devparana"]')?.classList.contains("hidden-by-filter"),
    ).toBe(true);
    expect(document.getElementById("stat-total")?.textContent).toBe("1");
    expect(document.getElementById("filter-desc")?.textContent).toBe("Filtro ativo: Discord Codaqui.");
  });

  it("shows all sources when the query parameter is invalid", () => {
    initEventFilters("?source=missing");

    expect(document.querySelector('[data-filter="all"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(
      document.querySelector('[data-source-key="meetup:devparana"]')?.classList.contains("hidden-by-filter"),
    ).toBe(false);
    expect(document.getElementById("stat-total")?.textContent).toBe("2");
  });

  it("updates the query string when a source chip is selected", () => {
    window.history.replaceState(null, "", "/eventos?source=discord%3Acodaqui");
    initEventFilters();
    document.querySelector<HTMLButtonElement>('[data-filter="meetup:devparana"]')?.click();

    expect(window.location.search).toBe("?source=meetup%3Adevparana");
    expect(
      document.querySelector('[data-filter="meetup:devparana"]')?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(document.getElementById("stat-total")?.textContent).toBe("1");
  });

  it("removes the source query when Tudo is selected", () => {
    window.history.replaceState(null, "", "/eventos?source=discord%3Acodaqui");
    initEventFilters();
    document.querySelector<HTMLButtonElement>('[data-filter="all"]')?.click();

    expect(window.location.search).toBe("");
    expect(document.querySelector('[data-filter="all"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(document.getElementById("stat-total")?.textContent).toBe("2");
  });

  it("restores the selected source on browser back and forward", () => {
    window.history.replaceState(null, "", "/eventos?source=discord%3Acodaqui");
    initEventFilters();
    document.querySelector<HTMLButtonElement>('[data-filter="meetup:devparana"]')?.click();
    window.history.back();

    return new Promise<void>((resolve) => {
      window.addEventListener(
        "popstate",
        () => {
          expect(window.location.search).toBe("?source=discord%3Acodaqui");
          expect(
            document.querySelector('[data-filter="discord:codaqui"]')?.getAttribute("aria-pressed"),
          ).toBe("true");
          expect(document.getElementById("stat-total")?.textContent).toBe("1");
          resolve();
        },
        { once: true },
      );
    });
  });
});
