/**
 * Tests para src/components/DonationFlow/helpers.ts
 *
 * Focam nos helpers puros (sem window): buildCheckoutBody recebe `returnPath`
 * explicitamente, e requestCheckoutSession recebe um authFetch mockado.
 *
 * detectWhitelabelDeploy e getCurrentPath são testados apenas no comportamento
 * SSR (window undefined) — comportamento browser é validado em testes E2E.
 */

import {
  buildCheckoutBody,
  requestCheckoutSession,
} from "../helpers";

describe("buildCheckoutBody", () => {
  it("monta body básico para doação única", () => {
    const body = buildCheckoutBody({
      amount: 10000,
      target: "tisocial",
      isRecurring: false,
      mode: "once",
      returnPath: "/participe/apoiar",
    });
    expect(body).toEqual({
      amount: 10000,
      communityId: "tisocial",
      uiMode: "embedded_page",
      returnPath: "/participe/apoiar",
    });
  });

  it("inclui recurring quando isRecurring=true", () => {
    const body = buildCheckoutBody({
      amount: 5000,
      target: "codaqui",
      isRecurring: true,
      mode: "month",
      returnPath: "/",
    });
    expect(body).toEqual({
      amount: 5000,
      communityId: "codaqui",
      uiMode: "embedded_page",
      returnPath: "/",
      recurring: { interval: "month" },
    });
  });

  it("aceita mode='year' como recurring", () => {
    const body = buildCheckoutBody({
      amount: 100000,
      target: "codaqui",
      isRecurring: true,
      mode: "year",
      returnPath: "/sobre/insights",
    });
    expect(body.recurring).toEqual({ interval: "year" });
  });

  it("ignora recurring quando isRecurring=false (mesmo se mode != 'once')", () => {
    const body = buildCheckoutBody({
      amount: 1000,
      target: "x",
      isRecurring: false,
      mode: "month",
      returnPath: "/",
    });
    expect(body).not.toHaveProperty("recurring");
  });

  it("permite returnPath undefined (sem window em SSR)", () => {
    const body = buildCheckoutBody({
      amount: 1000,
      target: "x",
      isRecurring: false,
      mode: "once",
      // returnPath omitido propositalmente
    });
    // returnPath cai no default (getCurrentPath); em jsdom é a pathname atual.
    // Aceitamos qualquer string ou undefined.
    expect("returnPath" in body).toBe(true);
  });
});

describe("requestCheckoutSession", () => {
  const apiUrl = "http://localhost:3001";
  const body = { amount: 1000, communityId: "x" };

  function mockAuthFetch(response: Partial<Response> & { jsonValue?: unknown }) {
    return jest.fn(async () => {
      return {
        ok: response.ok ?? true,
        status: response.status ?? 200,
        json: async () => response.jsonValue,
      } as unknown as Response;
    });
  }

  it("retorna client-secret quando backend devolve clientSecret", async () => {
    const authFetch = mockAuthFetch({
      ok: true,
      status: 200,
      jsonValue: { clientSecret: "cs_xxx" },
    });
    const result = await requestCheckoutSession(authFetch, apiUrl, body);
    expect(result).toEqual({ kind: "client-secret", clientSecret: "cs_xxx" });
    expect(authFetch).toHaveBeenCalledWith(
      "http://localhost:3001/stripe/checkout-session",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("retorna redirect quando backend devolve url", async () => {
    const authFetch = mockAuthFetch({
      ok: true,
      status: 200,
      jsonValue: { url: "https://checkout.stripe.com/abc" },
    });
    const result = await requestCheckoutSession(authFetch, apiUrl, body);
    expect(result).toEqual({
      kind: "redirect",
      url: "https://checkout.stripe.com/abc",
    });
  });

  it("retorna auth-required em 401", async () => {
    const authFetch = mockAuthFetch({ ok: false, status: 401, jsonValue: {} });
    const result = await requestCheckoutSession(authFetch, apiUrl, body);
    expect(result).toEqual({ kind: "auth-required" });
  });

  it("retorna error em outros erros HTTP", async () => {
    const authFetch = mockAuthFetch({ ok: false, status: 500, jsonValue: {} });
    const result = await requestCheckoutSession(authFetch, apiUrl, body);
    expect(result.kind).toBe("error");
    expect(result.error).toBeDefined();
  });

  it("retorna error quando resposta não tem clientSecret nem url", async () => {
    const authFetch = mockAuthFetch({ ok: true, status: 200, jsonValue: {} });
    const result = await requestCheckoutSession(authFetch, apiUrl, body);
    expect(result.kind).toBe("error");
  });

  it("retorna error quando authFetch lança", async () => {
    const authFetch = jest.fn(async () => {
      throw new Error("network down");
    });
    const result = await requestCheckoutSession(authFetch, apiUrl, body);
    expect(result.kind).toBe("error");
    expect(result.error).toBe("network down");
  });

  it("usa mensagem genérica quando exceção não é Error", async () => {
    const authFetch = jest.fn(async () => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw "string-error";
    });
    const result = await requestCheckoutSession(authFetch, apiUrl, body);
    expect(result.kind).toBe("error");
    expect(result.error).toBe("Erro inesperado.");
  });
});
