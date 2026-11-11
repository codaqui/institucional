// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCertificateInviteProgress } from "./useCertificateInviteProgress";
import type { CertificateInviteBatchProgress } from "./types";

describe("useCertificateInviteProgress", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads a resumed empty batch once without polling or refreshing registrations", async () => {
    const emptyBatch: CertificateInviteBatchProgress = {
      batchId: "batch-empty-resume",
      status: "queued",
      total: 0,
      completed: 0,
      queued: 0,
      processing: 0,
      retry: 0,
      failed: 0,
      skipped: 0,
      items: [],
    };
    const loadBatch = vi.fn().mockResolvedValue(emptyBatch);
    const onDone = vi.fn();
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useCertificateInviteProgress("batch-empty-resume", 0, loadBatch, onDone),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.progress?.total).toBe(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    expect(loadBatch).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });
});
