import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../test/http-mock";
import { useMyDesignations, type MyDesignation } from "./use-designations";

const authFetchMock = vi.hoisted(() => vi.fn());

vi.mock("./use-auth", () => ({
  useAuth: () => ({ authFetch: authFetchMock }),
}));

vi.mock("./api-url", () => ({
  resolveApiUrl: () => "https://api.test",
}));

const activeDesignation: MyDesignation = {
  id: "designation-1",
  targetType: "community",
  targetId: "community-1",
  targetKey: null,
  designation: "responsible",
};

describe("useMyDesignations", () => {
  beforeEach(() => {
    authFetchMock.mockReset();
  });

  it("loads the authenticated member designations", async () => {
    authFetchMock.mockResolvedValue(jsonResponse([activeDesignation]));

    const { result } = renderHook(() => useMyDesignations());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([activeDesignation]);
    expect(result.current.error).toBe("");
    expect(authFetchMock).toHaveBeenCalledWith(
      "https://api.test/designations/me",
    );
  });

  it("refreshes data after a designation action", async () => {
    authFetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([activeDesignation]));
    const { result } = renderHook(() => useMyDesignations());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.data).toEqual([activeDesignation]);
    expect(authFetchMock).toHaveBeenCalledTimes(2);
  });

  it("exposes API errors instead of hiding them", async () => {
    authFetchMock.mockResolvedValue(jsonResponse({}, { status: 500 }));

    const { result } = renderHook(() => useMyDesignations());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBe("Erro ao carregar dados (HTTP 500).");
  });

  it("exposes network failures", async () => {
    authFetchMock.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useMyDesignations());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(
      "Não foi possível carregar as designações.",
    );
  });
});
