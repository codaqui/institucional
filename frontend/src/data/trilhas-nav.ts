// Portado de sidebars.ts (Docusaurus) — fonte canônica até a Fase 0.6.
export interface TrilhaNavItem {
  slug: string;
  label: string;
}
export interface TrilhaNav {
  id: string;
  title: string;
  items: TrilhaNavItem[];
}

export const TRILHAS_NAV: TrilhaNav[] = [
  {
    id: "python",
    title: "Python 101",
    items: [
      { slug: "python", label: "Apresentação" },
      { slug: "python/page-1", label: "Aula 1: Variáveis e Tipos de Dados" },
      { slug: "python/page-2", label: "Aula 2: Estruturas Lógicas e Condicionais" },
      { slug: "python/page-3", label: "Aula 3: Estruturas de Repetição" },
      { slug: "python/page-4", label: "Aula 4: Coleções" },
      { slug: "python/page-5", label: "Aula 5: Funções" },
      { slug: "python/page-6", label: "Aula 6: Comprehensions" },
      { slug: "python/page-7", label: "Aula 7: Expressões Lambdas e Funções Integradas" },
      { slug: "python/page-8", label: "Aula 8: Debugando e Tratando Erros" },
      { slug: "python/page-9", label: "Aula 9: Trabalhando com Módulos" },
      { slug: "python/page-10", label: "Aula 10: Manipulação de Arquivos" },
      { slug: "python/page-11", label: "Aula 11: Iteradores e Geradores" },
      { slug: "python/page-12", label: "Aula 12: Decoradores" },
      { slug: "python/page-13", label: "Aula 13: Programação Orientada a Objetos" },
      { slug: "python/page-14", label: "Aula 14: Herança e Polimorfismo" },
      { slug: "python/page-15", label: "Aula 15: Testes em Python" },
      { slug: "python/page-16", label: "Aula 16: Atualizações e Recursos Recentes" },
    ],
  },
  {
    id: "github",
    title: "GitHub 101",
    items: [
      { slug: "github", label: "Apresentação" },
      { slug: "github/page-1", label: "Aula 1: Introdução ao Git" },
      { slug: "github/page-2", label: "Aula 2: Entendendo o Fluxo do GitHub" },
      { slug: "github/page-3", label: "Aula 3: Termos do GitHub" },
      { slug: "github/page-4", label: "Aula 4: Tarefas para Realizar" },
      { slug: "github/page-5", label: "Aula 5: Tarefa 1" },
      { slug: "github/page-6", label: "Aula 6: Em Construção" },
      { slug: "github/page-7", label: "Aula 7: Em Construção" },
      { slug: "github/page-8", label: "Aula 5: Recursos e Referências" },
    ],
  },
];
