/**
 * Mock minimal de @docusaurus/theme-common/internal para o ambiente de testes.
 *
 * Expõe apenas os hooks utilizados nos componentes testados.
 * Em runtime (browser), o módulo real é carregado pelo Webpack do Docusaurus.
 */

export function useNavbarMobileSidebar() {
  return {
    disabled: false,
    shouldRender: true,
    toggle: () => {},
  };
}

export function splitNavbarItems<T>(items: T[]): [T[], T[]] {
  return [items, []];
}
