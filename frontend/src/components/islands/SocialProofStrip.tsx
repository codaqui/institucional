import { useEffect, useState } from "react";
import BusinessIcon from "@mui/icons-material/Business";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { resolveApiUrl } from "../../lib/api-url";

export interface Donor {
  id: string;
  githubHandle: string;
  name: string;
  avatarUrl: string | null;
  totalDonated: number;
  donationCount: number;
}

export interface Sponsor {
  id: string;
  name: string;
  tradeName: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  status: string;
  tier: "amiga" | "aliada";
  sealValidUntil: string | null;
  sealActive: boolean;
  totalSupportedReais: number;
  supportCount: number;
  monthsSupporting: number;
}

/**
 * Shape real de GET /members/donors (backend/src/members/members.service.ts
 * → findDonors): paginado, NÃO um array direto.
 */
interface DonorsResponse {
  data?: Donor[];
  total?: number;
  page?: number;
  totalPages?: number;
  limit?: number;
}

/**
 * Shape real de GET /companies/sponsors (backend/src/companies/companies.service.ts
 * → listSponsorsPaginated): paginado com `items`.
 */
interface SponsorsResponse {
  items: Sponsor[];
  total: number;
  page: number;
  limit: number;
}

/** Slide do carrossel da home: pessoa apoiadora OU empresa patrocinadora. */
export type SupporterSlide =
  | { kind: "person"; id: string; name: string; avatarUrl: string | null }
  | {
      kind: "sponsor";
      id: string;
      name: string;
      legalName: string | null;
      logoUrl: string | null;
      websiteUrl: string | null;
      tier: Sponsor["tier"];
    };

/** Benefícios já publicados em /empresas, informados nos slides empresariais. */
const SPONSOR_BENEFITS = [
  "Vitrine na home",
  "Selo enquanto o apoio estiver ativo",
  "SortCoins na carteira",
] as const;

/**
 * Intercala pessoa → patrocinador → pessoa → patrocinador até a maior
 * coleção; se uma fonte estiver vazia, a outra continua sozinha.
 */
export function interleaveSupporters(
  donors: Donor[],
  sponsors: Sponsor[],
): SupporterSlide[] {
  const slides: SupporterSlide[] = [];
  const max = Math.max(donors.length, sponsors.length);
  for (let i = 0; i < max; i++) {
    const donor = donors[i];
    if (donor) {
      slides.push({
        kind: "person",
        id: donor.id,
        name: donor.name,
        avatarUrl: donor.avatarUrl ?? null,
      });
    }
    const sponsor = sponsors[i];
    if (sponsor) {
      slides.push({
        kind: "sponsor",
        id: sponsor.id,
        name: sponsor.tradeName ?? sponsor.name,
        legalName: sponsor.tradeName ? sponsor.name : null,
        logoUrl: sponsor.logoUrl ?? null,
        websiteUrl: sponsor.websiteUrl ?? null,
        tier: sponsor.tier,
      });
    }
  }
  return slides;
}

function normalizeSponsors(
  res: SponsorsResponse | Sponsor[] | null,
): Sponsor[] {
  if (Array.isArray(res)) return res;
  return Array.isArray(res?.items) ? res.items : [];
}

function tierLabel(tier: Sponsor["tier"]): string {
  return tier === "aliada" ? "Empresa Aliada Codaqui" : "Empresa Amiga Codaqui";
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

type StripState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; count: number | null; slides: SupporterSlide[] };

const CAROUSEL_LABEL = "Pessoas apoiadoras e empresas patrocinadoras";
const AUTOPLAY_INTERVAL_MS = 6000;

/**
 * prefers-reduced-motion via matchMedia, com fallback seguro para SSR e
 * ambientes sem matchMedia (jsdom, bots): trata como "sem preferência".
 */
function usePrefersReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(query).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** visibilitychange: pausa o autoplay com a aba em segundo plano. */
function useDocumentHidden(): boolean {
  const [hidden, setHidden] = useState(
    () => typeof document !== "undefined" && document.visibilityState === "hidden",
  );
  useEffect(() => {
    const onVisibilityChange = () =>
      setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);
  return hidden;
}

/** Faixa "N pessoas apoiam…" + carrossel de apoiadores e patrocinadores. */
export default function SocialProofStrip() {
  const [state, setState] = useState<StripState>({ status: "loading" });

  useEffect(() => {
    const apiUrl = resolveApiUrl(import.meta.env.SITE);
    let cancelled = false;

    const donorsPromise = fetch(`${apiUrl}/members/donors`)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null) as Promise<DonorsResponse | null>;
    const sponsorsPromise = fetch(`${apiUrl}/companies/sponsors`)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null) as Promise<SponsorsResponse | Sponsor[] | null>;

    void Promise.all([donorsPromise, sponsorsPromise]).then(
      ([donorsRes, sponsorsRes]) => {
        if (cancelled) return;
        if (donorsRes === null && sponsorsRes === null) {
          setState({ status: "error" });
          return;
        }
        const donors = Array.isArray(donorsRes?.data) ? donorsRes.data : [];
        const sponsors = normalizeSponsors(sponsorsRes);
        setState({
          status: "ready",
          count: donorsRes ? (donorsRes.total ?? donors.length) : null,
          slides: interleaveSupporters(donors, sponsors),
        });
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return <span className="inline-block h-6 w-64 animate-pulse rounded bg-sunken" />;
  }

  if (state.status === "error") {
    // Sem dados para slides: preserva fallback textual e o CTA empresarial,
    // sem inventar conteúdo.
    return (
      <div>
        <p className="text-sm text-text-secondary">
          Pessoas e empresas apoiam e constroem a Codaqui 💚
        </p>
        <a
          href="/empresas"
          className="text-sm font-semibold text-link underline underline-offset-2 hover:text-link-hover"
        >
          Quero apoiar como empresa
        </a>
      </div>
    );
  }

  if (state.slides.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-1">
      {state.count !== null && state.count > 0 && (
        <p className="text-sm text-text-secondary">
          <strong className="text-text-primary">{state.count} pessoas</strong>{" "}
          apoiam e constroem a Codaqui 💚
        </p>
      )}
      <SupportersCarousel slides={state.slides} />
    </div>
  );
}

function SupportersCarousel({ slides }: { slides: SupporterSlide[] }) {
  const [index, setIndex] = useState(0);
  // Ação manual (controles/indicadores) alterna a live region para polite;
  // o autoplay em si mantém aria-live="off".
  const [manual, setManual] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const pageHidden = useDocumentHidden();

  const total = slides.length;
  const multiple = total > 1;
  // Laço contínuo (último → primeiro) para não desabilitar controles nas
  // pontas e não perder foco.
  const goTo = (next: number) => setIndex(((next % total) + total) % total);
  const goManual = (next: number) => {
    setManual(true);
    goTo(next);
  };
  const slide = slides[index];

  const autoplay = multiple && !reducedMotion && !pageHidden && !hovered && !focused;

  useEffect(() => {
    if (!autoplay) return;
    const interval = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % total);
    }, AUTOPLAY_INTERVAL_MS);
    return () => window.clearInterval(interval);
    // `index` nas deps rearma o ciclo de 6s após qualquer mudança de slide
    // (manual ou automática), evitando tick herdado logo após clique.
  }, [autoplay, index, total]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label={CAROUSEL_LABEL}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
        <div className="flex min-h-16 items-center">
          <div
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} de ${total}`}
          >
            {slide.kind === "person" ? (
              <PersonSlide slide={slide} />
            ) : (
              <SponsorSlide slide={slide} />
            )}
          </div>
        </div>

        {multiple && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goManual(index - 1)}
              aria-label="Slide anterior"
              className="grid h-9 w-9 place-items-center rounded-full border border-border text-text-secondary transition-colors hover:text-text-primary"
            >
              <ChevronLeftIcon fontSize="small" />
            </button>
            <span
              aria-hidden="true"
              className="min-w-10 text-center text-xs text-text-secondary tabular-nums"
            >
              {index + 1} de {total}
            </span>
            <button
              type="button"
              onClick={() => goManual(index + 1)}
              aria-label="Próximo slide"
              className="grid h-9 w-9 place-items-center rounded-full border border-border text-text-secondary transition-colors hover:text-text-primary"
            >
              <ChevronRightIcon fontSize="small" />
            </button>
            <div role="group" aria-label="Escolher slide" className="flex items-center">
              {slides.map((s, i) => (
                <button
                  key={`${s.kind}-${s.id}`}
                  type="button"
                  onClick={() => goManual(i)}
                  aria-label={`Ir para o slide ${i + 1}: ${s.name}`}
                  aria-current={i === index ? "true" : undefined}
                  className="grid h-6 w-6 place-items-center rounded-full text-text-secondary transition-colors hover:text-text-primary"
                >
                  <span
                    aria-hidden="true"
                    className={
                      i === index
                        ? "block h-2.5 w-2.5 rounded-full bg-action"
                        : "block h-2 w-2 rounded-full bg-border-strong"
                    }
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {multiple && (
        // Região de status para leitores de tela: o autoplay mantém
        // aria-live="off"; após ação manual nos controles alterna para
        // "polite" para anunciar a nova posição.
        <p className="sr-only" role="status" aria-live={manual ? "polite" : "off"}>
          {`Slide ${index + 1} de ${total}`}
        </p>
      )}
    </section>
  );
}

function PersonSlide({ slide }: { slide: Extract<SupporterSlide, { kind: "person" }> }) {
  return (
    <div className="flex items-center gap-3">
      {slide.avatarUrl ? (
        <img
          src={slide.avatarUrl}
          alt=""
          width={44}
          height={44}
          loading="lazy"
          decoding="async"
          className="h-11 w-11 rounded-full object-contain"
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid h-11 w-11 place-items-center rounded-full bg-sunken text-sm font-bold text-text-primary"
        >
          {initialsOf(slide.name)}
        </span>
      )}
      <span className="flex flex-col items-start text-left">
        <span className="text-sm font-semibold text-text-primary">
          {slide.name}
        </span>
        <span className="text-xs text-text-secondary">Pessoa apoiadora</span>
      </span>
    </div>
  );
}

function SponsorSlide({
  slide,
}: {
  slide: Extract<SupporterSlide, { kind: "sponsor" }>;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
      {slide.logoUrl ? (
        <img
          src={slide.logoUrl}
          alt=""
          width={140}
          height={44}
          loading="lazy"
          decoding="async"
          className="h-11 max-w-[140px] object-contain"
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sunken text-text-primary"
        >
          <BusinessIcon fontSize="small" />
        </span>
      )}
      <span className="flex flex-col items-start text-left">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-text-primary">
            {slide.name}
          </span>
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
            {tierLabel(slide.tier)}
          </span>
        </span>
        {slide.legalName && (
          <span className="text-xs text-text-secondary">{slide.legalName}</span>
        )}
        <ul className="flex list-none flex-wrap gap-x-3 gap-y-0.5 p-0 text-xs text-text-secondary">
          {SPONSOR_BENEFITS.map((benefit) => (
            <li key={benefit}>{benefit}</li>
          ))}
        </ul>
      </span>
      {slide.websiteUrl && (
        <a
          href={slide.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-link underline underline-offset-2 hover:text-link-hover"
        >
          Visitar site
        </a>
      )}
    </div>
  );
}
