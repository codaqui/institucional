/**
 * Mock manual do qr-scanner para o ambiente de testes Jest/jsdom.
 *
 * Localizado em src/__mocks__/qr-scanner.ts — é carregado automaticamente
 * quando o teste chama jest.mock("qr-scanner").
 *
 * DESIGN: O estado da instância ativa é exportado via __state__ para que os
 * testes possam acessar a instância criada e simular scans.
 */

export interface MockQrScannerInstance {
  start: jest.Mock;
  stop: jest.Mock;
  destroy: jest.Mock;
  _onDecode: ((r: { data: string }) => void) | null;
  /** Dispara um scan simulado com o token informado */
  simulateScan: (token: string) => void;
}

/** Estado compartilhado acessível pelos testes via require/import do mock */
export const __state__: {
  instance: MockQrScannerInstance | null;
  hasCamera: jest.Mock;
} = {
  instance: null,
  hasCamera: jest.fn().mockResolvedValue(true),
};

function MockQrScanner(
  _video: HTMLVideoElement,
  onDecode: (result: { data: string }) => void,
) {
  const inst: MockQrScannerInstance = {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
    destroy: jest.fn(),
    _onDecode: onDecode,
    simulateScan: (token: string) => onDecode({ data: token }),
  };
  __state__.instance = inst;
  return inst;
}

MockQrScanner.hasCamera = __state__.hasCamera;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mock = MockQrScanner as any;
export default mock;
