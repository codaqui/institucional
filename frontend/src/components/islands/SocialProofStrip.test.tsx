import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMui } from "../../test/render-mui";
import { jsonResponse, useFetchMock } from "../../test/http-mock";
import SocialProofStrip, {
  SupportersCarousel,
  interleaveSupporters,
  shuffleSupporterSlides,
  shuffleSupporters,
} from "./SocialProofStrip";
import type { Donor, Sponsor } from "./SocialProofStrip";

const fetchMock = useFetchMock();

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.999999);
});

afterEach(() => {
  vi.mocked(Math.random).mockRestore();
});

const CAROUSEL_LABEL = "Pessoas apoiadoras e empresas patrocinadoras";

function donor(overrides: Partial<Donor> = {}): Donor {
  return {
    id: "member-ana",
    githubHandle: "anasouza",
    name: "Ana Souza",
    avatarUrl: "https://avatars.example/ana.png",
    totalDonated: 500,
    donationCount: 3,
    ...overrides,
  };
}

function sponsor(overrides: Partial<Sponsor> = {}): Sponsor {
  return {
    id: "company-teste",
    name: "Teste Tecnologia LTDA",
    tradeName: "Teste",
    logoUrl: "https://cdn.example/teste.png",
    websiteUrl: "https://teste.example",
    status: "active",
    tier: "amiga",
    sealValidUntil: null,
    sealActive: true,
    totalSupportedReais: 200,
    supportCount: 1,
    monthsSupporting: 2,
    ...overrides,
  };
}

function donorsEnvelope(donors: Donor[], total = donors.length) {
  return { data: donors, total, page: 1, limit: 50, totalPages: 1 };
}

function sponsorsEnvelope(sponsors: Sponsor[]) {
  return { items: sponsors, total: sponsors.length, page: 1, limit: 20 };
}

/** Mock por URL: /members/donors e /companies/sponsors. */
function mockSupportersApi({
  donors,
  donorsTotal,
  sponsors,
  sponsorsRaw,
}: {
  donors?: Donor[];
  donorsTotal?: number;
  sponsors?: Sponsor[];
  sponsorsRaw?: unknown;
}) {
  fetchMock.current.mockImplementation((input: unknown) => {
    const url = String(input);
    if (url.includes("/members/donors")) {
      return Promise.resolve(
        jsonResponse(donorsEnvelope(donors ?? [], donorsTotal ?? donors?.length ?? 0)),
      );
    }
    if (url.includes("/companies/sponsors")) {
      return Promise.resolve(
        jsonResponse(sponsorsRaw ?? sponsorsEnvelope(sponsors ?? [])),
      );
    }
    return Promise.reject(new Error(`fetch inesperado: ${url}`));
  });
}

describe("interleaveSupporters", () => {
  it("alterna pessoa → patrocinador até a maior coleção", () => {
    const slides = interleaveSupporters(
      [
        donor({ id: "member-1", name: "Ana Souza" }),
        donor({ id: "member-2", name: "Bruno Lima" }),
      ],
      [sponsor({ id: "company-1", tradeName: "Teste", name: "Teste Tecnologia LTDA" })],
    );

    expect(slides.map((s) => s.kind)).toEqual(["person", "sponsor", "person"]);
    expect(slides.map((s) => s.name)).toEqual(["Ana Souza", "Teste", "Bruno Lima"]);
  });

  it("mantém a outra coleção utilizável quando uma está vazia", () => {
    expect(
      interleaveSupporters([], [sponsor(), sponsor()]).map((s) => s.kind),
    ).toEqual(["sponsor", "sponsor"]);
    expect(interleaveSupporters([donor()], []).map((s) => s.kind)).toEqual([
      "person",
    ]);
  });
});

describe("shuffleSupporters", () => {
  it("embaralha com Fisher–Yates preservando todos os apoiadores", () => {
    const slides = shuffleSupporters(
      [
        donor({ id: "member-1", name: "Ana Souza" }),
        donor({ id: "member-2", name: "Bruno Lima" }),
      ],
      [sponsor({ id: "company-1", tradeName: "Teste", name: "Teste Tecnologia LTDA" })],
      () => 0,
    );

    expect(slides.map((slide) => slide.name)).toEqual([
      "Teste",
      "Bruno Lima",
      "Ana Souza",
    ]);
    expect(new Set(slides.map((slide) => `${slide.kind}-${slide.id}`)).size).toBe(3);
  });

  it("evita repetir o último apoiador na primeira posição do novo ciclo", () => {
    const slides = interleaveSupporters(
      [
        donor({ id: "member-1", name: "Ana Souza" }),
        donor({ id: "member-2", name: "Bruno Lima" }),
      ],
      [sponsor({ id: "company-1", tradeName: "Teste" })],
    );

    const shuffled = shuffleSupporterSlides(slides, () => 0.999999, slides[0]);

    expect(shuffled[0]?.name).toBe("Teste");
    expect(new Set(shuffled.map((slide) => `${slide.kind}-${slide.id}`)).size).toBe(3);
  });

  it("mantém um único apoiador sem quebrar a proteção da fronteira", () => {
    const slides = interleaveSupporters([donor()], []);
    const shuffled = shuffleSupporterSlides(slides, () => 0, slides[0]);

    expect(shuffled).toEqual(slides);
    expect(shuffled).not.toBe(slides);
  });
});

describe("SocialProofStrip", () => {
  it("preserva a contagem pública e renderiza a região de carrossel", async () => {
    mockSupportersApi({
      donors: [donor(), donor({ id: "member-bruno", name: "Bruno Lima" })],
      donorsTotal: 42,
      sponsors: [],
    });
    renderWithMui(<SocialProofStrip />);

    expect(await screen.findByText("42 pessoas")).toBeInTheDocument();
    expect(screen.getByText(/constroem a Codaqui/)).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: CAROUSEL_LABEL }),
    ).toBeInTheDocument();
  });

  it("mostra avatar e nome da pessoa sem valores ou quantidade de doações", async () => {
    mockSupportersApi({
      donors: [donor({ totalDonated: 1250, donationCount: 7 })],
      sponsors: [],
    });
    renderWithMui(<SocialProofStrip />);

    const region = await screen.findByRole("region", { name: CAROUSEL_LABEL });
    expect(within(region).getByText("Ana Souza")).toBeInTheDocument();
    expect(
      region.querySelector('img[src="https://avatars.example/ana.png"]'),
    ).not.toBeNull();
    expect(region.textContent).not.toMatch(/R\$|1\.250|1250|doaç/i);
    expect(within(region).getByText("Pessoa apoiadora")).toBeInTheDocument();
  });

  it("mostra logo, tier, benefícios publicados e site da empresa", async () => {
    mockSupportersApi({
      donors: [],
      donorsTotal: 0,
      sponsors: [sponsor()],
    });
    renderWithMui(<SocialProofStrip />);

    const region = await screen.findByRole("region", { name: CAROUSEL_LABEL });
    const logo = region.querySelector('img[src="https://cdn.example/teste.png"]');
    expect(logo).not.toBeNull();
    expect(logo?.className).toContain("object-contain");
    expect(logo?.getAttribute("width")).toBeTruthy();
    expect(logo?.getAttribute("height")).toBeTruthy();
    expect(within(region).getByText("Teste")).toBeInTheDocument();
    expect(within(region).getByText("Teste Tecnologia LTDA")).toBeInTheDocument();
    expect(within(region).getByText("Empresa Amiga Codaqui")).toBeInTheDocument();
    expect(within(region).getByText("Vitrine na home")).toBeInTheDocument();
    expect(
      within(region).getByText("Selo enquanto o apoio estiver ativo"),
    ).toBeInTheDocument();
    expect(within(region).getByText("SortCoins na carteira")).toBeInTheDocument();
    const site = within(region).getByRole("link", { name: "Visitar site" });
    expect(site).toHaveAttribute("href", "https://teste.example");
    expect(site).toHaveAttribute("target", "_blank");
    expect(site).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("usa iniciais/ícone com nome acessível quando não há imagem", async () => {
    mockSupportersApi({
      donors: [donor({ id: "member-cris", name: "Cris Rocha", avatarUrl: null })],
      donorsTotal: 1,
      sponsors: [sponsor({ id: "company-nologo", tradeName: "SemLogo", logoUrl: null })],
    });
    const user = userEvent.setup();
    renderWithMui(<SocialProofStrip />);

    const region = await screen.findByRole("region", { name: CAROUSEL_LABEL });
    expect(within(region).getByText("Cris Rocha")).toBeInTheDocument();
    expect(within(region).getByText("CR")).toBeInTheDocument();
    expect(region.querySelector("img")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Próximo slide" }));
    expect(within(region).getByText("SemLogo")).toBeInTheDocument();
    expect(region.querySelector("img")).toBeNull();
    expect(region.querySelector("svg")).not.toBeNull();
  });

  it("não renderiza link de site quando websiteUrl é nulo", async () => {
    mockSupportersApi({
      donors: [],
      donorsTotal: 0,
      sponsors: [sponsor({ websiteUrl: null, tradeName: "SemSite" })],
    });
    renderWithMui(<SocialProofStrip />);

    const region = await screen.findByRole("region", { name: CAROUSEL_LABEL });
    expect(within(region).getByText("SemSite")).toBeInTheDocument();
    expect(
      within(region).queryByRole("link", { name: "Visitar site" }),
    ).toBeNull();
  });

  it("funciona só com patrocinadores, sem exibir contagem zerada", async () => {
    mockSupportersApi({
      donors: [],
      donorsTotal: 0,
      sponsors: [sponsor({ tradeName: "SóEmpresa" })],
    });
    renderWithMui(<SocialProofStrip />);

    const region = await screen.findByRole("region", { name: CAROUSEL_LABEL });
    expect(within(region).getByText("SóEmpresa")).toBeInTheDocument();
    expect(screen.queryByText(/pessoas/)).toBeNull();
  });

  it("funciona só com pessoas, preservando a contagem", async () => {
    mockSupportersApi({
      donors: [donor()],
      donorsTotal: 9,
      sponsors: [],
    });
    renderWithMui(<SocialProofStrip />);

    expect(await screen.findByText("9 pessoas")).toBeInTheDocument();
    const region = screen.getByRole("region", { name: CAROUSEL_LABEL });
    expect(within(region).getByText("Ana Souza")).toBeInTheDocument();
  });

  it("mantém as pessoas quando a fonte de patrocinadores falha", async () => {
    fetchMock.current.mockImplementation((input: unknown) => {
      const url = String(input);
      if (url.includes("/members/donors")) {
        return Promise.resolve(jsonResponse(donorsEnvelope([donor()], 8)));
      }
      if (url.includes("/companies/sponsors")) {
        return Promise.resolve(jsonResponse(null, { status: 500 }));
      }
      return Promise.reject(new Error(`fetch inesperado: ${url}`));
    });
    renderWithMui(<SocialProofStrip />);

    expect(await screen.findByText("8 pessoas")).toBeInTheDocument();
    const region = screen.getByRole("region", { name: CAROUSEL_LABEL });
    expect(within(region).getByText("Ana Souza")).toBeInTheDocument();
  });

  it("normaliza resposta de patrocinadores como array direto", async () => {
    mockSupportersApi({
      donors: [donor()],
      donorsTotal: 1,
      sponsorsRaw: [sponsor({ tradeName: "ArrayCo" })],
    });
    const user = userEvent.setup();
    renderWithMui(<SocialProofStrip />);

    const region = await screen.findByRole("region", { name: CAROUSEL_LABEL });
    await user.click(
      screen.getByRole("button", { name: "Ir para o slide 2: ArrayCo" }),
    );
    expect(within(region).getByText("ArrayCo")).toBeInTheDocument();
  });

  it("preserva fallback textual e CTA empresarial quando as duas fontes falham", async () => {
    fetchMock.current.mockRejectedValue(new Error("fora do ar"));
    renderWithMui(<SocialProofStrip />);

    expect(await screen.findByText(/constroem a Codaqui/)).toBeInTheDocument();
    expect(screen.queryByText(/\d+ pessoas/)).toBeNull();
    const cta = screen.getByRole("link", { name: "Quero apoiar como empresa" });
    expect(cta).toHaveAttribute("href", "/empresas");
    expect(
      screen.queryByRole("region", { name: CAROUSEL_LABEL }),
    ).toBeNull();
  });

  it("navega em laço com anterior/próximo, posição e indicadores acessíveis", async () => {
    mockSupportersApi({
      donors: [donor(), donor({ id: "member-bruno", name: "Bruno Lima" })],
      donorsTotal: 2,
      sponsors: [sponsor()],
    });
    const user = userEvent.setup();
    renderWithMui(<SocialProofStrip />);

    const region = await screen.findByRole("region", { name: CAROUSEL_LABEL });
    expect(within(region).getByRole("group", { name: "1 de 3" })).toBeInTheDocument();
    expect(within(region).getByText("1 de 3")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ir para o slide 1: Ana Souza" }),
    ).toHaveAttribute("aria-current", "true");
    expect(
      screen.getByRole("button", { name: "Ir para o slide 2: Teste" }),
    ).not.toHaveAttribute("aria-current");

    await user.click(screen.getByRole("button", { name: "Próximo slide" }));
    expect(within(region).getByRole("group", { name: "2 de 3" })).toBeInTheDocument();
    expect(within(region).getByText("2 de 3")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ir para o slide 2: Teste" }),
    ).toHaveAttribute("aria-current", "true");

    await user.click(screen.getByRole("button", { name: "Slide anterior" }));
    expect(within(region).getByRole("group", { name: "1 de 3" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Slide anterior" }));
    expect(within(region).getByRole("group", { name: "3 de 3" })).toBeInTheDocument();
    expect(within(region).getByText("Bruno Lima")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ir para o slide 1: Ana Souza" }));
    expect(within(region).getByRole("group", { name: "1 de 3" })).toBeInTheDocument();
  });

  it("reinicia fila e posição quando os slides mudam", async () => {
    const initialSlides = interleaveSupporters(
      [donor(), donor({ id: "member-bruno", name: "Bruno Lima" })],
      [],
    );
    const nextSlides = interleaveSupporters(
      [],
      [sponsor({ tradeName: "Nova empresa" })],
    );
    const user = userEvent.setup();
    const { rerender } = renderWithMui(<SupportersCarousel slides={initialSlides} />);

    await user.click(screen.getByRole("button", { name: "Próximo slide" }));
    expect(screen.getByRole("group", { name: "2 de 2" })).toBeInTheDocument();

    rerender(<SupportersCarousel slides={nextSlides} />);

    expect(screen.getByRole("group", { name: "1 de 1" })).toBeInTheDocument();
    expect(screen.getByText("Nova empresa")).toBeInTheDocument();
  });

  describe("autoplay e interação", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      // Restaura o estado de visibilidade para não vazar entre testes.
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      vi.useRealTimers();
    });

    /** matchMedia "(prefers-reduced-motion: reduce)" com matches mutável. */
    function reducedMotionQuery(initialMatches: boolean) {
      const mql = {
        matches: initialMatches,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(mql));
      return mql;
    }

    function setPageHidden(hidden: boolean) {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: hidden ? "hidden" : "visible",
      });
      fireEvent(document, new Event("visibilitychange"));
    }

    async function renderCarousel() {
      const view = renderWithMui(<SocialProofStrip />);
      await act(async () => {
        // Drena a cadeia de promises do fetch mockado sem depender de
        // findBy* (que trava com timers falsos neste setup).
        for (let i = 0; i < 20; i++) await vi.advanceTimersByTimeAsync(0);
      });
      return { view, region: screen.getByRole("region", { name: CAROUSEL_LABEL }) };
    }

    async function advance(ms: number) {
      await act(async () => {
        vi.advanceTimersByTime(ms);
      });
    }

    function slideGroup(region: HTMLElement, label: string) {
      return within(region).getByRole("group", { name: label });
    }

    function statusOf(region: HTMLElement) {
      return within(region).getByRole("status");
    }

    it("avança automaticamente a cada 6s em laço e limpa o intervalo ao desmontar", async () => {
      mockSupportersApi({
        donors: [donor(), donor({ id: "member-bruno", name: "Bruno Lima" })],
        sponsors: [sponsor()],
      });
      const { view, region } = await renderCarousel();

      await advance(6000);
      expect(slideGroup(region, "2 de 3")).toBeInTheDocument();
      await advance(6000);
      expect(slideGroup(region, "3 de 3")).toBeInTheDocument();
      await advance(6000);
      expect(slideGroup(region, "1 de 3")).toBeInTheDocument();

      const timersBeforeUnmount = vi.getTimerCount();
      view.unmount();
      expect(vi.getTimerCount()).toBe(timersBeforeUnmount - 1);
    });

    it("mantém aria-live off no autoplay e anuncia posição só após ação manual", async () => {
      mockSupportersApi({
        donors: [donor(), donor({ id: "member-bruno", name: "Bruno Lima" })],
        sponsors: [],
      });
      const { region } = await renderCarousel();
      const status = () => statusOf(region);

      expect(status()).toHaveAttribute("aria-live", "off");

      await advance(6000);
      expect(slideGroup(region, "2 de 2")).toBeInTheDocument();
      expect(status()).toHaveAttribute("aria-live", "off");
      expect(status()).toHaveTextContent("Slide 2 de 2");

      // Ação manual: vira polite e anuncia a posição escolhida.
      fireEvent.click(screen.getByRole("button", { name: "Próximo slide" }));
      expect(slideGroup(region, "1 de 2")).toBeInTheDocument();
      expect(status()).toHaveAttribute("aria-live", "polite");
      expect(status()).toHaveTextContent("Slide 1 de 2");

      // Próximo tick automático: avança em silêncio, live volta a off.
      await advance(6000);
      expect(slideGroup(region, "2 de 2")).toBeInTheDocument();
      expect(status()).toHaveAttribute("aria-live", "off");

      // Nova ação manual: polite novamente.
      fireEvent.click(screen.getByRole("button", { name: "Slide anterior" }));
      expect(slideGroup(region, "1 de 2")).toBeInTheDocument();
      expect(status()).toHaveAttribute("aria-live", "polite");
    });

    it("rearma o ciclo de 6s após ação manual (sem avanço duplo)", async () => {
      mockSupportersApi({
        donors: [donor(), donor({ id: "member-bruno", name: "Bruno Lima" })],
        sponsors: [],
      });
      const { region } = await renderCarousel();

      await advance(5800);
      expect(slideGroup(region, "1 de 2")).toBeInTheDocument();

      // Clique a 200ms do tick: sem rearme, o tick herdado dispararia logo
      // após o avanço manual (double-skip).
      fireEvent.click(screen.getByRole("button", { name: "Próximo slide" }));
      expect(slideGroup(region, "2 de 2")).toBeInTheDocument();

      await advance(200);
      expect(slideGroup(region, "2 de 2")).toBeInTheDocument();

      // Rearmado: o avanço automático só ocorre 6s DEPOIS da ação manual.
      await advance(5600);
      expect(slideGroup(region, "2 de 2")).toBeInTheDocument();
      await advance(200);
      expect(slideGroup(region, "1 de 2")).toBeInTheDocument();
    });

    it("seleciona slide pelo indicador e anuncia a posição", async () => {
      mockSupportersApi({
        donors: [donor(), donor({ id: "member-bruno", name: "Bruno Lima" })],
        sponsors: [sponsor()],
      });
      const { region } = await renderCarousel();

      fireEvent.click(
        screen.getByRole("button", { name: "Ir para o slide 3: Bruno Lima" }),
      );
      expect(slideGroup(region, "3 de 3")).toBeInTheDocument();
      expect(statusOf(region)).toHaveAttribute("aria-live", "polite");
      expect(
        screen.getByRole("button", { name: "Ir para o slide 3: Bruno Lima" }),
      ).toHaveAttribute("aria-current", "true");
    });

    it("pausa ao pairar sobre o carrossel e retoma ao sair", async () => {
      mockSupportersApi({
        donors: [donor(), donor({ id: "member-bruno", name: "Bruno Lima" })],
        sponsors: [],
      });
      const { region } = await renderCarousel();

      await advance(6000);
      expect(slideGroup(region, "2 de 2")).toBeInTheDocument();

      fireEvent.mouseOver(region);
      await advance(6000);
      expect(slideGroup(region, "2 de 2")).toBeInTheDocument();

      fireEvent.mouseOut(region);
      await advance(6000);
      expect(slideGroup(region, "1 de 2")).toBeInTheDocument();
    });

    it("pausa com foco dentro do carrossel e retoma ao sair", async () => {
      mockSupportersApi({
        donors: [donor(), donor({ id: "member-bruno", name: "Bruno Lima" })],
        sponsors: [],
      });
      const { region } = await renderCarousel();
      const next = () => screen.getByRole("button", { name: "Próximo slide" });

      await advance(6000);
      expect(slideGroup(region, "2 de 2")).toBeInTheDocument();

      fireEvent.focus(next());
      await advance(6000);
      expect(slideGroup(region, "2 de 2")).toBeInTheDocument();

      fireEvent.blur(next());
      await advance(6000);
      expect(slideGroup(region, "1 de 2")).toBeInTheDocument();
    });

    it("pausa quando a página fica oculta e retoma ao voltar", async () => {
      mockSupportersApi({
        donors: [donor(), donor({ id: "member-bruno", name: "Bruno Lima" })],
        sponsors: [],
      });
      const { region } = await renderCarousel();

      await advance(6000);
      expect(slideGroup(region, "2 de 2")).toBeInTheDocument();

      setPageHidden(true);
      await advance(6000);
      expect(slideGroup(region, "2 de 2")).toBeInTheDocument();

      setPageHidden(false);
      await advance(6000);
      expect(slideGroup(region, "1 de 2")).toBeInTheDocument();
    });

    it("não inicia o autoplay quando a página já carrega oculta", async () => {
      setPageHidden(true);
      mockSupportersApi({
        donors: [donor(), donor({ id: "member-bruno", name: "Bruno Lima" })],
        sponsors: [],
      });
      const { region } = await renderCarousel();

      await advance(12_000);
      expect(slideGroup(region, "1 de 2")).toBeInTheDocument();
    });

    it("respeita prefers-reduced-motion: sem avanço automático, navegação manual preservada", async () => {
      reducedMotionQuery(true);
      mockSupportersApi({
        donors: [donor(), donor({ id: "member-bruno", name: "Bruno Lima" })],
        sponsors: [],
      });
      const { region } = await renderCarousel();

      await advance(18_000);
      expect(slideGroup(region, "1 de 2")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Próximo slide" }));
      expect(slideGroup(region, "2 de 2")).toBeInTheDocument();
    });

    it("pausa quando prefers-reduced-motion passa a valer e retoma ao sair", async () => {
      const mql = reducedMotionQuery(false);
      mockSupportersApi({
        donors: [donor(), donor({ id: "member-bruno", name: "Bruno Lima" })],
        sponsors: [],
      });
      const { region } = await renderCarousel();

      await advance(6000);
      expect(slideGroup(region, "2 de 2")).toBeInTheDocument();

      const changeListener = mql.addEventListener.mock.calls.find(
        (call) => call[0] === "change",
      )?.[1] as (event: Event) => void;

      mql.matches = true;
      await act(async () => {
        changeListener(new Event("change"));
      });
      await advance(6000);
      expect(slideGroup(region, "2 de 2")).toBeInTheDocument();

      mql.matches = false;
      await act(async () => {
        changeListener(new Event("change"));
      });
      await advance(6000);
      expect(slideGroup(region, "1 de 2")).toBeInTheDocument();
    });

    it("usa chave estável por tipo e id nos indicadores (sem colisão entre kinds)", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        mockSupportersApi({
          donors: [donor({ id: "mesmo-id", name: "Ana Souza" })],
          sponsors: [sponsor({ id: "mesmo-id", tradeName: "Teste" })],
        });
        const { region } = await renderCarousel();

        expect(within(region).getByText("Ana Souza")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Próximo slide" }));
        expect(within(region).getByText("Teste")).toBeInTheDocument();
        expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(/same key/i);
      } finally {
        consoleError.mockRestore();
      }
    });

    it("expõe aria-roledescription carousel na região e slide no grupo ativo", async () => {
      mockSupportersApi({ donors: [donor()], sponsors: [sponsor()] });
      const { region } = await renderCarousel();

      expect(region).toHaveAttribute("aria-roledescription", "carousel");
      expect(slideGroup(region, "1 de 2")).toHaveAttribute(
        "aria-roledescription",
        "slide",
      );
    });
  });
});
