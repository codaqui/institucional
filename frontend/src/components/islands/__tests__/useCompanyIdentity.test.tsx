import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useCompanyIdentity } from "../useCompanyIdentity";

const company = {
  id: "company-1",
  name: "Empresa X",
  cnpj: "12345678000199",
  status: "pending",
  logoUrl: null,
  websiteUrl: null,
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("useCompanyIdentity", () => {
  it("loads an existing company and formats its CNPJ", async () => {
    const authFetch = vi.fn().mockResolvedValue(response(company));

    const { result } = renderHook(() => useCompanyIdentity({ enabled: true, authFetch }));

    await waitFor(() => expect(result.current.existingCompany).toEqual(company));
    expect(result.current.cnpj).toBe("12.345.678/0001-99");
    expect(result.current.name).toBe("Empresa X");
    expect(result.current.loadingCompany).toBe(false);
  });

  it("does not fetch or register when disabled", async () => {
    const authFetch = vi.fn();

    const { result } = renderHook(() => useCompanyIdentity({ enabled: false, authFetch }));

    expect(result.current.existingCompany).toBeNull();
    await expect(result.current.registerCompany()).rejects.toThrow("Cadastro indisponível");
    expect(authFetch).not.toHaveBeenCalled();
  });

  it("validates CNPJ and name before registering", async () => {
    const authFetch = vi.fn().mockResolvedValue(response(null));
    const { result } = renderHook(() => useCompanyIdentity({ enabled: true, authFetch }));

    await act(async () => {
      await expect(result.current.registerCompany()).rejects.toThrow("CNPJ deve ter 14 dígitos");
    });
    expect(result.current.formError).toBe("CNPJ deve ter 14 dígitos.");
    expect(authFetch).not.toHaveBeenCalledWith("/companies", expect.anything());

    await act(async () => {
      result.current.setCnpj("12.345.678/0001-99");
    });
    await act(async () => {
      await result.current.registerCompany().catch(() => undefined);
    });
    expect(result.current.formError).toBe("Razão social é obrigatória.");
    expect(authFetch).not.toHaveBeenCalledWith("/companies", expect.anything());
  });

  it("registers a pending company and exposes it to both flows", async () => {
    const authFetch = vi.fn()
      .mockResolvedValueOnce(response(null))
      .mockResolvedValueOnce(response(company));
    const { result } = renderHook(() => useCompanyIdentity({ enabled: true, authFetch }));

    await act(async () => {
      result.current.setCnpj("12.345.678/0001-99");
      result.current.setName("Empresa X");
    });
    await act(async () => {
      await result.current.registerCompany();
    });

    expect(result.current.existingCompany).toEqual(company);
    expect(authFetch).toHaveBeenCalledWith("/companies", {
      method: "POST",
      body: JSON.stringify({ cnpj: "12345678000199", name: "Empresa X" }),
    });
    expect(result.current.formError).toBeNull();
  });
});
