/**
 * Mock manual do qr-scanner para o ambiente de testes Vitest/jsdom.
 * Port de `src/__mocks__/qr-scanner.ts` (Docusaurus/jest).
 *
 * Registrado nos testes via:
 *
 * ```ts
 * vi.mock("qr-scanner", () => import("../../../../../test/mocks/qr-scanner"));
 * ```
 *
 * DESIGN: o estado da instância ativa é exportado via `__state__` para que os
 * testes possam acessar a instância criada e simular scans. `__factory__`
 * permite substituir a fábrica de instâncias (ex.: injetar um `start()` que
 * rejeita) sem mutar o namespace do módulo mockado.
 */
import { vi } from "vitest";

export interface MockQrScannerInstance {
  start: ReturnType<typeof vi.fn<() => Promise<void>>>;
  stop: ReturnType<typeof vi.fn<() => void>>;
  destroy: ReturnType<typeof vi.fn<() => void>>;
  _onDecode: ((r: { data: string }) => void) | null;
  /** Dispara um scan simulado com o token informado */
  simulateScan: (token: string) => void;
}

export type MockQrScannerFactory = (
  video: HTMLVideoElement,
  onDecode: (result: { data: string }) => void,
  options?: unknown,
) => MockQrScannerInstance;

/** Estado compartilhado acessível pelos testes via import do mock */
export const __state__: {
  instance: MockQrScannerInstance | null;
  hasCamera: ReturnType<typeof vi.fn<() => Promise<boolean>>>;
} = {
  instance: null,
  hasCamera: vi.fn<() => Promise<boolean>>(() => Promise.resolve(true)),
};

/** Fábrica de instâncias substituível pelos testes (restaurar após o uso). */
export const __factory__: { current: MockQrScannerFactory } = {
  current: (_video, onDecode) => {
    const inst: MockQrScannerInstance = {
      start: vi.fn<() => Promise<void>>(() => Promise.resolve()),
      stop: vi.fn(() => {}),
      destroy: vi.fn(() => {}),
      _onDecode: onDecode,
      simulateScan: (token: string) => onDecode({ data: token }),
    };
    __state__.instance = inst;
    return inst;
  },
};

const MockQrScanner = Object.assign(
  function MockQrScanner(
    video: HTMLVideoElement,
    onDecode: (result: { data: string }) => void,
    options?: unknown,
  ) {
    return __factory__.current(video, onDecode, options);
  },
  { hasCamera: () => __state__.hasCamera() },
);

export default MockQrScanner;
