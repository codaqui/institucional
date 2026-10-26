/**
 * Helpers puros da tela de check-in — port de
 * `src/pages/admin/eventos-checkin.tsx` (Docusaurus) para Astro.
 */
import type { AuthUser } from "../../../../lib/auth-client";

/** Prefixo do valor do seletor para eventos externos: `external:<eventKey>`. */
export const EXTERNAL_PREFIX = "external:";

/** Multi-role: o backend expõe `roles: string[]` na sessão (migração Fase 2). */
export function getUserRoles(user: AuthUser | null): string[] {
  return user?.roles ?? [];
}

export const CHECKIN_ROLES = ["admin", "event_organizer", "event_checker"];

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function formatOrderStatus(status: string): string {
  if (status === "paid") return "Pago";
  if (status === "refunded") return "Reembolsado";
  return status;
}

/**
 * Verifica se a câmera pode ser usada (getUserMedia disponível).
 * Pode retornar false em HTTP não-seguro ou em ambientes sem câmera.
 */
export const isCameraAvailable = (): boolean =>
  typeof window !== "undefined" &&
  typeof navigator !== "undefined" &&
  typeof navigator.mediaDevices !== "undefined" &&
  typeof navigator.mediaDevices.getUserMedia === "function";

/**
 * Timeout defensivo para ativação da câmera. Em alguns navegadores/ambientes
 * (ex.: Firefox headless sem câmera, drivers quebrados) `getUserMedia` e
 * `enumerateDevices` nunca resolvem — sem timeout a UI trava em "Ativando...".
 */
export const CAMERA_START_TIMEOUT_MS = 15000;

/**
 * Race de uma promise com timeout. A promise original sempre recebe handlers,
 * então uma resolução tardia (após o timeout) não vira unhandled rejection.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          Object.assign(new Error("camera start timeout"), {
            name: "CameraTimeoutError",
          }),
        ),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Traduz erros de câmera (DOMException.name de getUserMedia) em mensagem
 * amigável PT-BR. Exportada para facilitar testes unitários.
 */
export function translateCameraError(err: unknown): string {
  if (err instanceof Error) {
    const name = (err as DOMException).name ?? "";
    if (name === "CameraTimeoutError") {
      return "A câmera demorou para responder. Verifique se outro aplicativo não está usando a câmera e tente novamente.";
    }
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return "Permissão de câmera negada. Toque no ícone de cadeado na barra de endereços e permita o acesso à câmera.";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "Nenhuma câmera encontrada neste dispositivo.";
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return "A câmera está sendo usada por outro aplicativo. Feche-o e tente novamente.";
    }
    if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
      return "A câmera não pôde ser iniciada. Tente novamente.";
    }
    if (name === "AbortError") {
      return "A inicialização da câmera foi interrompida. Tente novamente.";
    }
  }
  return "Não foi possível acessar a câmera. Verifique a permissão do navegador ou use a busca manual.";
}
