import { describe, expect, it, vi } from "vitest";
import { parseAuthJson, extractErrorMessage } from "./auth-fetch-helpers";

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("parseAuthJson", () => {
  it("retorna o payload em 2xx", async () => {
    expect(await parseAuthJson<{ a: number }>(jsonRes({ a: 1 }), vi.fn())).toEqual({
      a: 1,
    });
  });

  it("chama onError com mensagem de sessão expirada e retorna null em 401", async () => {
    const onError = vi.fn();
    expect(await parseAuthJson(jsonRes({}, 401), onError)).toBeNull();
    expect(onError).toHaveBeenCalledWith(
      "Sessão expirada — faça login novamente.",
    );
  });

  it("chama onError com mensagem contextualizada pelo status em outros erros", async () => {
    const onError = vi.fn();
    expect(await parseAuthJson(jsonRes({ message: "falhou" }, 400), onError)).toBeNull();
    expect(onError).toHaveBeenCalledWith("Erro ao carregar dados (HTTP 400).");
  });

  it("chama onError com mensagem de resposta inválida quando o JSON falha", async () => {
    const onError = vi.fn();
    expect(
      await parseAuthJson(new Response("not-json", { status: 200 }), onError),
    ).toBeNull();
    expect(onError).toHaveBeenCalledWith("Resposta inválida do servidor.");
  });
});

describe("extractErrorMessage", () => {
  it("extrai message do JSON de erro", async () => {
    expect(await extractErrorMessage(jsonRes({ message: "nope" }, 422), "fallback")).toBe(
      "nope",
    );
  });

  it("junta message quando vem como array", async () => {
    expect(
      await extractErrorMessage(
        jsonRes({ message: ["a", "b"] }, 400),
        "fallback",
      ),
    ).toBe("a b");
  });

  it("retorna mensagem de sessão expirada em 401, ignorando o fallback", async () => {
    expect(await extractErrorMessage(jsonRes({}, 401), "fallback")).toBe(
      "Sessão expirada — faça login novamente.",
    );
  });

  it("cai no fallback em resposta vazia/sem message", async () => {
    expect(
      await extractErrorMessage(new Response("", { status: 500 }), "fallback"),
    ).toBe("fallback");
    expect(await extractErrorMessage(jsonRes({}, 500), "fallback")).toBe(
      "fallback",
    );
  });
});
