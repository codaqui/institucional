import {
  parseAuthJson,
  extractErrorMessage,
} from "../authFetchHelpers";
import { jsonResponse, type MockResponse } from "../../test-utils/http";

describe("parseAuthJson", () => {
  it("retorna o JSON parseado quando a resposta é ok", async () => {
    const res = jsonResponse([{ id: 1 }]) as Response;
    const onError = jest.fn();

    const data = await parseAuthJson<{ id: number }[]>(res, onError);

    expect(data).toEqual([{ id: 1 }]);
    expect(onError).not.toHaveBeenCalled();
  });

  it("retorna null e mensagem de sessão expirada em 401", async () => {
    const res = jsonResponse(null, { ok: false, status: 401 }) as Response;
    const onError = jest.fn();

    const data = await parseAuthJson(res, onError);

    expect(data).toBeNull();
    expect(onError).toHaveBeenCalledWith("Sessão expirada — faça login novamente.");
  });

  it("retorna null e mensagem com HTTP status em outros erros", async () => {
    const res = jsonResponse(null, { ok: false, status: 500 }) as Response;
    const onError = jest.fn();

    const data = await parseAuthJson(res, onError);

    expect(data).toBeNull();
    expect(onError).toHaveBeenCalledWith("Erro ao carregar dados (HTTP 500).");
  });

  it("retorna null e mensagem de resposta inválida quando o JSON quebra", async () => {
    const res: MockResponse = {
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("invalid json");
      },
    };
    const onError = jest.fn();

    const data = await parseAuthJson(res as Response, onError);

    expect(data).toBeNull();
    expect(onError).toHaveBeenCalledWith("Resposta inválida do servidor.");
  });
});

describe("extractErrorMessage", () => {
  it("retorna mensagem de sessão expirada em 401 sem ler o body", async () => {
    const json = jest.fn();
    const res = { ok: false, status: 401, json } as unknown as Response;

    const msg = await extractErrorMessage(res, "fallback");

    expect(msg).toBe("Sessão expirada — faça login novamente.");
    expect(json).not.toHaveBeenCalled();
  });

  it("extrai message string do body", async () => {
    const res = jsonResponse({ message: "CNPJ inválido" }, { ok: false, status: 400 }) as Response;

    const msg = await extractErrorMessage(res, "fallback");

    expect(msg).toBe("CNPJ inválido");
  });

  it("junta message array do body (class-validator)", async () => {
    const res = jsonResponse(
      { message: ["campo obrigatório", "formato inválido"] },
      { ok: false, status: 400 },
    ) as Response;

    const msg = await extractErrorMessage(res, "fallback");

    expect(msg).toBe("campo obrigatório formato inválido");
  });

  it("usa o fallback quando o body não tem message", async () => {
    const res = jsonResponse({}, { ok: false, status: 400 }) as Response;

    const msg = await extractErrorMessage(res, "Falha ao salvar.");

    expect(msg).toBe("Falha ao salvar.");
  });

  it("usa o fallback quando o body não é JSON", async () => {
    const res: MockResponse = {
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("not json");
      },
    };

    const msg = await extractErrorMessage(res as Response, "Erro de rede.");

    expect(msg).toBe("Erro de rede.");
  });
});
