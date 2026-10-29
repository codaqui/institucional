// Setup global do Jest (backend): mocks de pacotes ESM-only.
//
// Por que existem: marked v18 e htmlparser2 v12 (dep aninhada do
// sanitize-html) são ESM-only e o runtime CJS do Jest não consegue carregá-los
// ("Cannot use import statement outside a module"). Como o backend roda em
// Node 24+, carregamos os pacotes REAIS via require(esm) nativo do Node, fora
// do registry do Jest — process.getBuiltinModule contorna o shim que o Jest
// aplica ao builtin 'module'.
//
// ⚠️ O caminho 'sanitize-html/node_modules/htmlparser2' depende do layout de
// node_modules do npm: se specs falharem de repente com "Cannot use import
// statement", verifique se o npm deixou de hoistar o htmlparser2@12 para fora
// do node_modules aninhado do sanitize-html e ajuste o caminho do mock.
//
// ⚠️ Não atualizar o Jest para >= 30.5 sem reescrever os mocks abaixo: a partir
// dessa versão o jest-runtime sobrescreve process.getBuiltinModule no sandbox
// (installGetBuiltinModule) e o bypass deixa de funcionar — as factories caem
// em recursão infinita ("Maximum call stack size exceeded"). O lockfile mantém
// o monorepo do Jest em 30.3.0; um `npm audit fix` futuro pode tentar subi-lo
// (a cadeia dev do deepmerge), o que reintroduz a quebra de propósito.
jest.mock('marked', () => {
  const { createRequire } = process.getBuiltinModule('module');
  return createRequire(__filename)('marked');
});

jest.mock('sanitize-html/node_modules/htmlparser2', () => {
  const { createRequire } = process.getBuiltinModule('module');
  const nodeRequire = createRequire(
    require.resolve('sanitize-html/package.json'),
  );
  return nodeRequire('htmlparser2');
});
