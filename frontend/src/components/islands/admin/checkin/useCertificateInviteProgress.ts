import { useCallback, useEffect, useRef, useState } from "react";
import type { CertificateInviteBatchProgress } from "./types";

export function useCertificateInviteProgress(
  batchId: string | null,
  initialTotal: number,
  loadBatch: (batchId: string) => Promise<CertificateInviteBatchProgress>,
  onDone: () => Promise<void>,
) {
  const [progress, setProgress] = useState<CertificateInviteBatchProgress | null>(null);
  const [error, setError] = useState("");
  const terminalRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!batchId || terminalRef.current) return;
    setError("");
    try {
      const next = await loadBatch(batchId);
      setProgress(next);
      if (next.status === "completed") {
        terminalRef.current = true;
        await onDone();
      }
    } catch {
      setError("Não foi possível atualizar o progresso. Tente novamente.");
    }
  }, [batchId, loadBatch, onDone]);

  useEffect(() => {
    terminalRef.current = false;
    setProgress(null);
    setError("");
    if (!batchId) return;
    let timer: number | null = null;
    const stop = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    };
    const start = (immediate: boolean) => {
      if (document.visibilityState !== "visible" || terminalRef.current) return;
      if (immediate) void refresh();
      if (timer === null) {
        timer = window.setInterval(() => {
          if (!terminalRef.current) void refresh();
        }, 5000);
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") start(false);
      else stop();
    };
    start(true);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [batchId, refresh]);

  return {
    progress: progress ?? (batchId ? {
      batchId,
      status: "queued" as const,
      total: initialTotal,
      completed: 0,
      queued: initialTotal,
      processing: 0,
      retry: 0,
      failed: 0,
      skipped: 0,
      items: [],
    } : null),
    error,
    refresh,
  };
}
