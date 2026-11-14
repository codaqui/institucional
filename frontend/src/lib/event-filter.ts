interface EventFilterStats {
  total: number;
  recurring: number;
  rsvps: number;
  label: string | null;
}

export function resolveEventSourceFilter(
  search: string,
  sourceKeys: readonly string[],
): string {
  const requestedSource = new URLSearchParams(search).get("source");
  return requestedSource && sourceKeys.includes(requestedSource)
    ? requestedSource
    : "all";
}

export function initEventFilters(search = window.location.search): void {
  const pageSize = 12;
  const statsEl = document.getElementById("events-stats");
  const stats = statsEl
    ? (JSON.parse(statsEl.textContent ?? "{}") as Record<string, EventFilterStats>)
    : {};
  const chips = [...document.querySelectorAll<HTMLButtonElement>("[data-filter]")];
  const cards = [...document.querySelectorAll<HTMLElement>("[data-event-card]")];
  const featuredSection = document.getElementById("featured-section");
  const upcomingEmpty = document.getElementById("upcoming-empty");
  const pastEmpty = document.getElementById("past-empty");
  const loadMoreWrap = document.getElementById("past-load-more");
  const filterDesc = document.getElementById("filter-desc");
  const statTotal = document.getElementById("stat-total");
  const statRecurring = document.getElementById("stat-recurring");
  const statRsvps = document.getElementById("stat-rsvps");
  let current = "all";
  let pastShown = pageSize;

  const matches = (card: HTMLElement) =>
    current === "all" || card.dataset.sourceKey === current;

  function updateUrl(key: string): void {
    const url = new URL(window.location.href);
    if (key === "all") {
      url.searchParams.delete("source");
    } else {
      url.searchParams.set("source", key);
    }

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history.pushState(null, "", nextUrl);
    }
  }

  function applyPagination(): void {
    const visible = cards.filter(
      (card) => card.dataset.section === "past" && matches(card),
    );
    visible.forEach((card, index) => {
      card.classList.toggle("hidden-by-page", index >= pastShown);
    });
    if (pastEmpty) pastEmpty.hidden = visible.length > 0;
    if (loadMoreWrap) loadMoreWrap.hidden = pastShown >= visible.length;
  }

  function applyFilter(key: string): void {
    current = key;
    pastShown = pageSize;
    chips.forEach((chip) =>
      chip.setAttribute("aria-pressed", String(chip.dataset.filter === key)),
    );

    const statsForFilter = stats[key] ?? stats.all;
    if (statsForFilter) {
      if (statTotal) statTotal.textContent = String(statsForFilter.total);
      if (statRecurring) statRecurring.textContent = String(statsForFilter.recurring);
      if (statRsvps) statRsvps.textContent = String(statsForFilter.rsvps);
    }
    if (filterDesc) {
      filterDesc.textContent = statsForFilter?.label
        ? `Filtro ativo: ${statsForFilter.label}.`
        : "Você está vendo a visão geral com todas as comunidades integradas.";
    }

    let upcomingVisible = 0;
    let featuredVisible = 0;
    cards.forEach((card) => {
      const show = matches(card);
      card.classList.toggle("hidden-by-filter", !show);
      if (show && card.dataset.section === "upcoming") upcomingVisible += 1;
      if (show && card.dataset.section === "featured") featuredVisible += 1;
    });
    if (upcomingEmpty) upcomingEmpty.hidden = upcomingVisible > 0;
    if (featuredSection) featuredSection.hidden = featuredVisible === 0;
    applyPagination();
  }

  chips.forEach((chip) =>
    chip.addEventListener("click", () => {
      const key = chip.dataset.filter ?? "all";
      updateUrl(key);
      applyFilter(key);
    }),
  );
  current = resolveEventSourceFilter(
    search,
    chips.flatMap((chip) =>
      chip.dataset.filter && chip.dataset.filter !== "all"
        ? [chip.dataset.filter]
        : [],
    ),
  );
  applyFilter(current);

  window.addEventListener("popstate", () => {
    current = resolveEventSourceFilter(
      window.location.search,
      chips.flatMap((chip) =>
        chip.dataset.filter && chip.dataset.filter !== "all"
          ? [chip.dataset.filter]
          : [],
      ),
    );
    applyFilter(current);
  });

  loadMoreWrap?.querySelector("button")?.addEventListener("click", () => {
    pastShown += pageSize;
    applyPagination();
  });
}
