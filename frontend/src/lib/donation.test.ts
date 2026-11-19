import { describe, expect, it, vi } from "vitest";
import {
  ANONYMOUS_LIMIT_CENTS,
  buildCheckoutBody,
  formatBRL,
  MAX_DONATION_CENTS,
  MIN_DONATION_CENTS,
  parseDonationAmountCents,
  PRESET_AMOUNTS,
  requestCheckoutSession,
  validateDonationAmount,
} from "./donation";

describe("buildCheckoutBody", () => {
  it("monta body de pagamento único sem recurring", () => {
    const body = buildCheckoutBody({
      amount: 2500,
      target: "tesouro-geral",
      isRecurring: false,
      mode: "once",
      returnPath: "/participe/apoiar",
    });
    expect(body).toEqual({
      amount: 2500,
      communityId: "tesouro-geral",
      uiMode: "embedded_page",
      returnPath: "/participe/apoiar",
    });
    expect(body.recurring).toBeUndefined();
  });

  it("inclui recurring.interval quando recorrente", () => {
    const body = buildCheckoutBody({
      amount: 10000,
      target: "devparana",
      isRecurring: true,
      mode: "year",
      returnPath: "/participe/apoiar",
    });
    expect(body.recurring).toEqual({ interval: "year" });
  });
});

describe("requestCheckoutSession", () => {
  const jsonResponse = (status: number, data: unknown) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  it("retorna client-secret quando o backend responde clientSecret", async () => {
    const authFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { clientSecret: "cs_secret_123" }));
    const result = await requestCheckoutSession(authFetch, { amount: 1000 });
    expect(result).toEqual({ kind: "client-secret", clientSecret: "cs_secret_123" });
    expect(authFetch).toHaveBeenCalledWith(
      "/stripe/checkout-session",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("retorna redirect quando o backend responde url (fallback hosted)", async () => {
    const authFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { url: "https://checkout.stripe.com/x" }));
    const result = await requestCheckoutSession(authFetch, {});
    expect(result).toEqual({ kind: "redirect", url: "https://checkout.stripe.com/x" });
  });

  it("mapeia 401 para auth-required", async () => {
    const authFetch = vi.fn().mockResolvedValue(jsonResponse(401, {}));
    const result = await requestCheckoutSession(authFetch, {});
    expect(result.kind).toBe("auth-required");
  });

  it("mapeia erro HTTP para error genérico", async () => {
    const authFetch = vi.fn().mockResolvedValue(jsonResponse(500, {}));
    const result = await requestCheckoutSession(authFetch, {});
    expect(result).toEqual({ kind: "error", error: "Falha ao criar sessão de pagamento." });
  });

  it("mapeia resposta sem clientSecret/url para error", async () => {
    const authFetch = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    const result = await requestCheckoutSession(authFetch, {});
    expect(result).toEqual({ kind: "error", error: "Resposta inesperada do servidor." });
  });

  it("captura exceção de rede", async () => {
    const authFetch = vi.fn().mockRejectedValue(new Error("offline"));
    const result = await requestCheckoutSession(authFetch, {});
    expect(result).toEqual({ kind: "error", error: "offline" });
  });
});

describe("constantes", () => {
  it("limite de anonimato é R$ 100", () => {
    expect(ANONYMOUS_LIMIT_CENTS).toBe(10_000);
  });

  it("formatBRL formata em pt-BR", () => {
    expect(formatBRL(25)).toMatch(/R\$\s*25,00/);
  });
});

describe("parseDonationAmountCents", () => {
  it.each([
    ["1", 100],
    ["1,00", 100],
    ["15,5", 1550],
    ["15.50", 1550],
    ["R$ 25", 2500],
    [" 1000 ", 100_000],
    ["1.000", 100_000],
    ["1.000,00", 100_000],
    ["0,99", 99],
  ])("converte %p em %p centavos", (raw, cents) => {
    expect(parseDonationAmountCents(raw)).toBe(cents);
  });

  it.each(["", "   ", "abc", "-5", "1,234", "10,", "1e3", "1.00.0", "NaN"])(
    "rejeita %p",
    (raw) => {
      expect(parseDonationAmountCents(raw)).toBeNull();
    },
  );
});

describe("validateDonationAmount", () => {
  it.each([
    ["1,00", 100],
    ["1000,00", 100_000],
    ["1.000,00", 100_000],
  ])("aceita o limite %p", (raw, cents) => {
    expect(validateDonationAmount(raw)).toEqual({ cents, error: null });
  });

  it("rejeita abaixo de R$ 1,00", () => {
    const result = validateDonationAmount("0,99");
    expect(result.cents).toBeNull();
    expect(result.error).toContain("mínimo");
  });

  it("rejeita acima de R$ 1.000,00", () => {
    const result = validateDonationAmount("1000,01");
    expect(result.cents).toBeNull();
    expect(result.error).toContain("máximo");
  });

  it.each(["", "abc", "-1", "0"])("rejeita entrada inválida %p", (raw) => {
    expect(validateDonationAmount(raw).cents).toBeNull();
  });

  it("mantém os presets dentro dos limites", () => {
    for (const preset of PRESET_AMOUNTS) {
      expect(preset.cents).toBeGreaterThanOrEqual(MIN_DONATION_CENTS);
      expect(preset.cents).toBeLessThanOrEqual(MAX_DONATION_CENTS);
    }
  });
});
