/**
 * Mock minimal de @docusaurus/theme-common para o ambiente de testes.
 *
 * Expõe apenas os hooks utilizados nos componentes testados.
 * Em runtime (browser), o módulo real é carregado pelo Webpack do Docusaurus.
 */

export function useColorMode() {
  return { colorMode: "light" as const, setColorMode: () => {} };
}
